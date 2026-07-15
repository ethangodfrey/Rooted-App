import type { ConfigService } from '@nestjs/config';
import type { PosProvider } from '@prisma/client';

/**
 * Retired Railway public hostnames → current production service URL.
 * Keeps OAuth/webhook redirects working when PUBLIC_BASE_URL still points at a deleted deploy.
 */
const STALE_PROVIDER_BASE_REMAP: Record<string, string> = {
  'rooted-app-production-8ba5.up.railway.app':
    'https://rooted-app-production-43fb.up.railway.app',
};

/**
 * Public HTTPS URL Square (and other providers) use for OAuth redirects and
 * webhooks. Prefer `POS_PROVIDER_BASE_URL` in local dev so the mobile app can
 * keep calling the backend over a LAN IP while provider callbacks use a tunnel.
 */
export function posProviderBaseUrl(config: ConfigService): string {
  const explicit = config.get<string>('POS_PROVIDER_BASE_URL', '').trim();
  if (explicit) {
    return remapStaleProviderBase(explicit);
  }

  // Only fall back when PUBLIC_BASE_URL is already HTTPS (production). Never use a
  // LAN http:// address for provider OAuth redirects or webhooks.
  const fallback = config.get<string>('PUBLIC_BASE_URL', '').trim();
  if (fallback && isHttpsUrl(fallback)) {
    return remapStaleProviderBase(fallback);
  }

  // Last-resort production default when env still points at a retired Railway URL.
  return 'https://rooted-app-production-43fb.up.railway.app';
}

export function remapStaleProviderBase(url: string): string {
  const normalized = url.trim().replace(/\/$/, '');
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    const mapped = STALE_PROVIDER_BASE_REMAP[host];
    if (mapped) return mapped;
  } catch {
    /* keep normalized */
  }
  return normalized;
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function posOAuthRedirectUri(config: ConfigService, provider: PosProvider): string {
  return `${posProviderBaseUrl(config)}/pos/oauth/${provider.toLowerCase()}/callback`;
}

export function posWebhookUrl(config: ConfigService, provider: PosProvider): string {
  return `${posProviderBaseUrl(config)}/pos/webhooks/${provider.toLowerCase()}`;
}
