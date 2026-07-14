import { NextResponse } from 'next/server';

import { markConnectionOAuthError } from '@/lib/integration/pos-connections-db';
import { persistOAuthTokens } from '@/lib/integration/persist-oauth-tokens';
import {
  exchangeProviderOAuthCode,
  squareAuthCallbackUrl,
  verifyOAuthState,
} from '@/lib/integration/pos-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function renderReturnHtml(status: 'success' | 'error', detail?: string): string {
  const title = status === 'success' ? 'Square connected' : 'Square connection failed';
  const body =
    status === 'success'
      ? 'You can close this window and return to Vendorly.'
      : (detail ?? 'Authorization was not completed.');
  const safeDetail = body.replace(/[<>&]/g, (ch) => {
    switch (ch) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      default:
        return ch;
    }
  });
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;color:#292524}h1{font-size:1.25rem}</style>
</head><body><h1>${title}</h1><p>${safeDetail}</p>
<script>try{window.opener&&window.opener.postMessage({type:'vendorly-square-oauth',status:'${status}'},'*')}catch(e){}</script>
</body></html>`;
}

/**
 * GET /api/auth/callback/square?code=...&state=...
 *
 * Validates CSRF state, exchanges the auth code for production tokens,
 * encrypts them into encrypted_credentials, and updates connection metadata.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code')?.trim() ?? '';
  const state = url.searchParams.get('state')?.trim() ?? '';
  const oauthError = url.searchParams.get('error')?.trim();
  const oauthErrorDescription = url.searchParams.get('error_description')?.trim();

  if (oauthError || !code || !state) {
    const detail = oauthErrorDescription ?? oauthError ?? 'missing_code';
    if (state) {
      await markConnectionOAuthError('square', state, detail);
    }
    return new NextResponse(renderReturnHtml('error', detail), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const payload = verifyOAuthState(state);
  if (!payload || payload.provider !== 'square') {
    return new NextResponse(renderReturnHtml('error', 'Invalid or expired OAuth state'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const redirectUri = squareAuthCallbackUrl();
    const tokens = await exchangeProviderOAuthCode('square', code, redirectUri);

    await persistOAuthTokens({
      vendorId: payload.vendorId,
      userId: payload.userId,
      provider: 'square',
      tokens,
      oauthState: state,
      connectedVia: 'tenant-web-auth-square',
    });

    return new NextResponse(renderReturnHtml('success'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_callback_failed';
    await markConnectionOAuthError('square', state, message);
    return new NextResponse(renderReturnHtml('error', message), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
