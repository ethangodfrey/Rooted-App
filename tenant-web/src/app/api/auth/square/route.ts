import { NextResponse } from 'next/server';

import { corsHeadersFor, corsPreflightResponse } from '@/lib/integration/cors';
import { fetchVendorForUser } from '@/lib/integration/pos-connections-db';
import {
  providerAuthorizeUrl,
  signOAuthState,
  squareAuthCallbackUrl,
} from '@/lib/integration/pos-oauth';
import { isUuid } from '@/lib/integration/types';
import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/square?vendorId=<uuid>
 * Authorization: Bearer <supabase access token>
 *
 * Builds a cryptographically signed CSRF `state` and redirects (or returns JSON)
 * to the Square production/sandbox authorize URL.
 */
export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  const cors = corsHeadersFor(request);
  const url = new URL(request.url);
  const vendorId = url.searchParams.get('vendorId')?.trim() ?? '';
  const wantsJson =
    url.searchParams.get('format') === 'json' ||
    (request.headers.get('accept') ?? '').includes('application/json');

  if (!isUuid(vendorId)) {
    return NextResponse.json({ error: 'Invalid vendorId' }, { status: 400, headers: cors });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401, headers: cors });
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401, headers: cors });
  }

  const vendor = await fetchVendorForUser(vendorId, identity.id);
  if (!vendor) {
    return NextResponse.json(
      { error: 'Vendor not found for this user' },
      { status: 403, headers: cors },
    );
  }

  try {
    const redirectUri = squareAuthCallbackUrl();
    const state = signOAuthState({
      vendorId,
      userId: identity.id,
      provider: 'square',
    });
    const authorizeUrl = providerAuthorizeUrl('square', state, redirectUri);

    if (wantsJson) {
      return NextResponse.json(
        {
          authorizeUrl,
          redirectUri,
          provider: 'square',
          environment: process.env.SQUARE_ENVIRONMENT?.trim() || 'sandbox',
        },
        { status: 200, headers: cors },
      );
    }

    const response = NextResponse.redirect(authorizeUrl, { status: 302 });
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_connect_failed';
    return NextResponse.json({ error: message }, { status: 503, headers: cors });
  }
}
