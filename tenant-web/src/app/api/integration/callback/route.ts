import { NextResponse } from 'next/server';

import {
  markConnectionOAuthError,
  upsertVendorPosConnection,
} from '@/lib/integration/pos-connections-db';
import {
  exchangeProviderOAuthCode,
  oauthCallbackUrl,
  verifyOAuthState,
} from '@/lib/integration/pos-oauth';
import { isPosIntegrationProvider } from '@/lib/integration/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function renderReturnHtml(status: 'success' | 'error', detail?: string): string {
  const title = status === 'success' ? 'POS connected' : 'Connection failed';
  const body =
    status === 'success'
      ? 'You can close this window and return to Vendorly.'
      : (detail ?? 'Authorization was not completed.');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;color:#292524}h1{font-size:1.25rem}</style>
</head><body><h1>${title}</h1><p>${body}</p></body></html>`;
}

/**
 * GET /api/integration/callback?provider=square&code=...&state=...
 *
 * Provider OAuth redirect target. Exchanges the authorization code for tokens and
 * persists the connection in vendor_pos_connections (service-role).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const providerParam = url.searchParams.get('provider')?.trim().toLowerCase() ?? '';
  const code = url.searchParams.get('code')?.trim() ?? '';
  const state = url.searchParams.get('state')?.trim() ?? '';
  const oauthError = url.searchParams.get('error')?.trim();
  const oauthErrorDescription = url.searchParams.get('error_description')?.trim();

  if (!isPosIntegrationProvider(providerParam)) {
    return new NextResponse(renderReturnHtml('error', 'Invalid provider'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (oauthError || !code || !state) {
    const detail = oauthErrorDescription ?? oauthError ?? 'missing_code';
    if (state) {
      await markConnectionOAuthError(providerParam, state, detail);
    }
    return new NextResponse(renderReturnHtml('error', detail), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const payload = verifyOAuthState(state);
  if (!payload || payload.provider !== providerParam) {
    return new NextResponse(renderReturnHtml('error', 'Invalid or expired OAuth state'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const redirectUri = oauthCallbackUrl(providerParam);
    const tokens = await exchangeProviderOAuthCode(providerParam, code, redirectUri);

    await upsertVendorPosConnection({
      vendor_id: payload.vendorId,
      user_id: payload.userId,
      provider: providerParam,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? null,
      token_expires_at: tokens.expiresAt ?? null,
      provider_merchant_id: tokens.merchantId ?? null,
      provider_location_id: tokens.locationId ?? null,
      oauth_state: state,
      status: 'active',
      metadata: { connectedVia: 'tenant-web-integration' },
      updated_at: new Date().toISOString(),
    });

    return new NextResponse(renderReturnHtml('success'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_callback_failed';
    await markConnectionOAuthError(providerParam, state, message);
    return new NextResponse(renderReturnHtml('error', message), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
