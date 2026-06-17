import type { ConfigService } from '@nestjs/config';
import type { PosProvider } from '@prisma/client';

/**
 * Public HTTPS URL Square (and other providers) use for OAuth redirects and
 * webhooks. Prefer `POS_PROVIDER_BASE_URL` in local dev so the mobile app can
 * keep calling the backend over a LAN IP while provider callbacks use a tunnel.
 */
export function posProviderBaseUrl(config: ConfigService): string {
  const explicit = config.get<string>('POS_PROVIDER_BASE_URL', '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  // Only fall back when PUBLIC_BASE_URL is already HTTPS (production). Never use a
  // LAN http:// address for provider OAuth redirects or webhooks.
  const fallback = config.get<string>('PUBLIC_BASE_URL', '').trim();
  if (fallback && isHttpsUrl(fallback)) {
    return fallback.replace(/\/$/, '');
  }

  return '';
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
