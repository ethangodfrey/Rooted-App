import { isDevLanOrigin } from '../network.util';

const LEGACY_VENDORLY_HTTPS_ORIGIN =
  /^https:\/\/([a-z0-9-]+\.)*vendorly\.app(?::\d+)?$/i;

const MARKETPLACE_COM_HTTPS_ORIGIN =
  /^https:\/\/([a-z0-9-]+\.)*vendorlymarketplace\.com(?::\d+)?$/i;

const MARKETPLACE_APP_HTTPS_ORIGIN =
  /^https:\/\/([a-z0-9-]+\.)*vendorlymarketplace\.app(?::\d+)?$/i;

/**
 * Vendorly marketplace hosts on Vercel, including:
 * - production aliases (vendorly-marketplace1.vercel.app)
 * - git/branch preview + deployment URLs
 *   (vendorly-marketplace1-*-ethangodfreys-projects.vercel.app)
 */
const VERCEL_MARKETPLACE_HOST =
  /^vendorly([-.]?marketplace\d*)([.-][a-z0-9-]+)*\.vercel\.app$/i;

function hostnameTrusted(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'vendorlymarketplace.com') return true;
  if (host.endsWith('.vendorlymarketplace.com')) return true;
  if (host === 'vendorlymarketplace.app') return true;
  if (host.endsWith('.vendorlymarketplace.app')) return true;
  // Legacy apex retained during DNS cutover.
  if (host === 'vendorly.app') return true;
  if (host.endsWith('.vendorly.app')) return true;
  return false;
}

/** Verified Vendorly production hostnames over HTTPS (apex + subdomains). */
export function isTrustedVendorlyOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    return hostnameTrusted(url.hostname);
  } catch {
    return (
      MARKETPLACE_COM_HTTPS_ORIGIN.test(origin) ||
      MARKETPLACE_APP_HTTPS_ORIGIN.test(origin) ||
      LEGACY_VENDORLY_HTTPS_ORIGIN.test(origin)
    );
  }
}

export function isTrustedVercelMarketplaceOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (VERCEL_MARKETPLACE_HOST.test(host)) return true;
    // Deployment URLs under the Vercel team project namespace.
    return host.includes('vendorly') && host.endsWith('.vercel.app');
  } catch {
    return false;
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
