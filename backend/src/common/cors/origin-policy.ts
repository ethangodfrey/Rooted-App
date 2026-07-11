import { isDevLanOrigin } from '../network.util';

const VENDORLY_HTTPS_ORIGIN =
  /^https:\/\/([a-z0-9-]+\.)*vendorly\.app(?::\d+)?$/i;

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

  if (options.isDev && isDevLanOrigin(origin)) {
    return true;
  }

  return false;
}
