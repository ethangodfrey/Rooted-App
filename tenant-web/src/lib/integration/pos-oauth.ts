import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { PosIntegrationProvider, PosOAuthStatePayload } from '@/lib/integration/types';

const STATE_TTL_MS = 15 * 60 * 1000;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function oauthStateSecret(): string | null {
  const secret =
    process.env.POS_OAUTH_STATE_SECRET?.trim() ||
    process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim() ||
    process.env.TENANT_REVALIDATE_SECRET?.trim();
  return secret || null;
}

export function signOAuthState(payload: Omit<PosOAuthStatePayload, 'exp' | 'nonce'>): string {
  const secret = oauthStateSecret();
  if (!secret) {
    throw new Error('POS_OAUTH_STATE_SECRET is not configured');
  }

  const body: PosOAuthStatePayload = {
    ...payload,
    nonce: randomBytes(16).toString('hex'),
    exp: Date.now() + STATE_TTL_MS,
  };

  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): PosOAuthStatePayload | null {
  const secret = oauthStateSecret();
  if (!secret) return null;

  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return null;

  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as PosOAuthStatePayload;
    if (!payload.vendorId || !payload.userId || !payload.provider || !payload.exp) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True when a URL looks like Square's OAuth host (not our callback origin). */
function isSquareConnectHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'connect.squareup.com' ||
      host === 'connect.squareupsandbox.com' ||
      host.endsWith('.squareup.com') ||
      host.endsWith('.squareupsandbox.com')
    );
  } catch {
    return false;
  }
}

/**
 * Public tenant-web origin used to build OAuth redirect_uri values.
 * Must NOT be Square's connect host — that belongs in SQUARE_ENVIRONMENT + authorize URL.
 */
export function integrationBaseUrl(): string {
  const candidates = [
    process.env.INTEGRATION_OAUTH_BASE_URL?.trim(),
    process.env.TENANT_WEB_URL?.trim(),
    process.env.PUBLIC_BASE_URL?.trim(),
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\/$/, '');
    if (isSquareConnectHost(normalized)) {
      console.warn(
        '[pos-oauth] Ignoring Square connect host as INTEGRATION_OAUTH_BASE_URL; use your tenant-web origin instead.',
      );
      continue;
    }
    return normalized;
  }

  return 'http://localhost:3000';
}

export function oauthCallbackUrl(provider: PosIntegrationProvider): string {
  return `${integrationBaseUrl()}/api/integration/callback?provider=${provider}`;
}

/** Production Square OAuth redirect registered in the Square Developer Dashboard. */
export function squareAuthCallbackUrl(): string {
  return `${integrationBaseUrl()}/api/auth/callback/square`;
}

export function providerAuthorizeUrl(
  provider: PosIntegrationProvider,
  state: string,
  redirectUri: string,
): string {
  switch (provider) {
    case 'square': {
      const clientId = process.env.SQUARE_APPLICATION_ID?.trim();
      if (!clientId) throw new Error('SQUARE_APPLICATION_ID is not configured');
      const env = process.env.SQUARE_ENVIRONMENT?.trim() || 'sandbox';
      const base =
        env === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com';
      const params = new URLSearchParams({
        client_id: clientId,
        scope: 'ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ',
        state,
        redirect_uri: redirectUri,
      });
      if (env === 'production') params.set('session', 'false');
      return `${base}/oauth2/authorize?${params.toString()}`;
    }
    case 'clover': {
      const clientId = process.env.CLOVER_APP_ID?.trim();
      if (!clientId) throw new Error('CLOVER_APP_ID is not configured');
      const env = process.env.CLOVER_ENVIRONMENT?.trim() || 'sandbox';
      const base =
        env === 'production' ? 'https://www.clover.com' : 'https://sandbox.dev.clover.com';
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        state,
      });
      return `${base}/oauth/v2/authorize?${params.toString()}`;
    }
    case 'toast': {
      // Toast partner integrations use client-credentials; redirect to partner docs.
      return 'https://doc.toasttab.com/doc/devguide/apiPartnerIntegrationOverview.html';
    }
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }
}

export async function exchangeProviderOAuthCode(
  provider: PosIntegrationProvider,
  code: string,
  redirectUri: string,
): Promise<import('@/lib/integration/types').PosOAuthTokenResult> {
  switch (provider) {
    case 'square': {
      const clientId = process.env.SQUARE_APPLICATION_ID?.trim();
      const clientSecret = process.env.SQUARE_APPLICATION_SECRET?.trim();
      if (!clientId || !clientSecret) {
        throw new Error('Square OAuth credentials are not configured');
      }
      const env = process.env.SQUARE_ENVIRONMENT?.trim() || 'sandbox';
      const base =
        env === 'production'
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com';
      const res = await fetch(`${base}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-12-18' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Square token exchange failed: ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: string;
        merchant_id?: string;
      };
      if (!data.access_token) throw new Error('Square token exchange returned no access_token');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: data.expires_at ?? null,
        merchantId: data.merchant_id ?? null,
      };
    }
    case 'clover': {
      const clientId = process.env.CLOVER_APP_ID?.trim();
      const clientSecret = process.env.CLOVER_APP_SECRET?.trim();
      if (!clientId || !clientSecret) {
        throw new Error('Clover OAuth credentials are not configured');
      }
      const env = process.env.CLOVER_ENVIRONMENT?.trim() || 'sandbox';
      const base =
        env === 'production' ? 'https://www.clover.com' : 'https://sandbox.dev.clover.com';
      const res = await fetch(`${base}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Clover token exchange failed: ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        access_token_expiration?: number;
        merchant_id?: string;
      };
      if (!data.access_token) throw new Error('Clover token exchange returned no access_token');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: data.access_token_expiration
          ? new Date(data.access_token_expiration * 1000).toISOString()
          : null,
        merchantId: data.merchant_id ?? null,
      };
    }
    case 'toast':
      throw new Error(
        'Toast uses partner client-credentials auth, not browser OAuth. Configure via NestJS POS API.',
      );
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }
}
