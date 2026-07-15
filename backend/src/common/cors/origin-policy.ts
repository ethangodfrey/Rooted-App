import { isDevLanOrigin } from '../network.util';

const VENDORLY_HTTPS_ORIGIN =
  /^https:\/\/([a-z0-9-]+\.)*vendorly\.app(?::\d+)?$/i;

/** Known Vendorly marketplace hosts on Vercel before custom domain DNS is ready. */
const TRUSTED_VERCEL_MARKETPLACE_ORIGINS = new Set([
  'https://vendorly-marketplace1.vercel.app',
  'https://vendorlymarketplace.vercel.app',
  'https://vendorlymarketplace1.vercel.app',
]);

/** Verified Vendorly production hostnames over HTTPS (apex + subdomains). */
export function isTrustedVendorlyOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    if (url.hostname === 'vendorly.app') return true;
    return url.hostname.endsWith('.vendorly.app');
  } catch {
    return VENDORLY_HTTPS_ORIGIN.test(origin);
  }
}

export function isTrustedVercelMarketplaceOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    const normalized = `${url.protocol}//${url.hostname}`.toLowerCase();
    return TRUSTED_VERCEL_MARKETPLACE_ORIGINS.has(normalized);
  } catch {
    return TRUSTED_VERCEL_MARKETPLACE_ORIGINS.has(origin.replace(/\/$/, '').toLowerCase());
  }
}

export interface CorsOriginPolicyOptions {
  isDev: boolean;
  allowedOrigins: Set<string>;
}

/**
 * Returns whether a browser Origin header should be accepted.
 * Stripe and other provider webhooks are server-to-server and do not send Origin.
 */
export function isCorsOriginAllowed(
  origin: string | undefined,
  options: CorsOriginPolicyOptions,
): boolean {
  if (!origin) {
    return options.isDev;
  }

  if (options.allowedOrigins.has(origin)) {
    return true;
  }

  if (!options.isDev && isTrustedVendorlyOrigin(origin)) {
    return true;
  }

  if (!options.isDev && isTrustedVercelMarketplaceOrigin(origin)) {
    return true;
  }

  if (options.isDev && isDevLanOrigin(origin)) {
    return true;
  }

  return false;
}
