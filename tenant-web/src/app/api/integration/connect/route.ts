import { NextResponse } from 'next/server';

import { fetchVendorForUser } from '@/lib/integration/pos-connections-db';
import {
  oauthCallbackUrl,
  providerAuthorizeUrl,
  signOAuthState,
} from '@/lib/integration/pos-oauth';
import { isPosIntegrationProvider, isUuid } from '@/lib/integration/types';
import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/integration/connect?provider=square&vendorId=<uuid>
 * Authorization: Bearer <supabase access token>
 *
 * Constructs a signed OAuth state and redirects the vendor to the provider
 * merchant authorization dashboard.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const providerParam = url.searchParams.get('provider')?.trim().toLowerCase() ?? '';
  const vendorId = url.searchParams.get('vendorId')?.trim() ?? '';

  if (!isPosIntegrationProvider(providerParam)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }
  if (!isUuid(vendorId)) {
    return NextResponse.json({ error: 'Invalid vendorId' }, { status: 400 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const vendor = await fetchVendorForUser(vendorId, identity.id);
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found for this user' }, { status: 403 });
  }

  try {
    const redirectUri = oauthCallbackUrl(providerParam);
    const state = signOAuthState({
      vendorId,
      userId: identity.id,
      provider: providerParam,
    });
    const authorizeUrl = providerAuthorizeUrl(providerParam, state, redirectUri);
    return NextResponse.redirect(authorizeUrl, { status: 302 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_connect_failed';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
