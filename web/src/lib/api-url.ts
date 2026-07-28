const API_PORT = 4000;

/**
 * Live Railway public URL. Used when `api.vendorlymarketplace.app` DNS is not configured
 * (or as a production fallback). Prefer a custom domain once DNS points at Railway.
 */
export const RAILWAY_PUBLIC_API_URL =
  'https://rooted-app-production-43fb.up.railway.app';

/** Canonical custom domain once CNAME cutover is complete. */
export const CANONICAL_API_ORIGIN = 'https://api.vendorlymarketplace.app';

/** True when VITE_API_URL is set to an absolute https URL (production / tunnel). */
export function isExplicitPublicApiUrl(): boolean {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim();
  return configured.startsWith('https://');
}

function normalizeConfiguredApiUrl(configured: string): string {
  const trimmed = configured.replace(/\/$/, '');
  if (!trimmed) return trimmed;

  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    // Custom domains may not resolve until CNAME cutover completes.
    if (
      host === 'api.vendorlymarketplace.app' ||
      host === 'api.vendorly.app'
    ) {
      return RAILWAY_PUBLIC_API_URL;
    }
  } catch {
    /* keep configured value */
  }

  return trimmed;
}

function tryParseHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isProductionRuntime(): boolean {
  // Vite production builds set PROD; NODE_ENV is also replaced at build time.
  return Boolean(import.meta.env.PROD) || import.meta.env.MODE === 'production';
}

export function resolveApiBaseUrl(): string {
  const rawConfigured = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  const configured = normalizeConfiguredApiUrl(rawConfigured);

  if (typeof window === 'undefined') {
    // SSR / build-time: production always targets Railway when unset.
    if (isProductionRuntime()) {
      return configured.startsWith('https://') ? configured : RAILWAY_PUBLIC_API_URL;
    }
    return configured || '';
  }

  const { hostname, protocol } = window.location;
  const onLocalMachine = hostname === 'localhost' || hostname === '127.0.0.1';

  // Production (NODE_ENV === 'production' / Vite PROD): never call localhost.
  // Prefer explicit https VITE_API_URL; otherwise bind to Railway public URL.
  if (isProductionRuntime()) {
    if (configured.startsWith('https://')) {
      return configured;
    }
    return RAILWAY_PUBLIC_API_URL;
  }

  if (configured) {
    // HTTPS or any non-localhost URL: always honor env (works off LAN / cellular).
    if (configured.startsWith('https://')) {
      return configured;
    }
    const configHost = tryParseHostname(configured);
    const pointsToLocalhost = configHost === 'localhost' || configHost === '127.0.0.1';
    // LAN dev: localhost in .env but browser opened at 192.168.x.x → same machine :4000
    if (!onLocalMachine && pointsToLocalhost) {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
    return configured;
  }

  if (import.meta.env.DEV) {
    return `${protocol}//${hostname}:${API_PORT}`;
  }

  // Production builds without VITE_API_URL still need the live Railway API.
  return RAILWAY_PUBLIC_API_URL;
}

export function isApiUrlConfigured(): boolean {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim();
  // Production always has the Railway fallback in resolveApiBaseUrl().
  return configured.length > 0 || import.meta.env.DEV || import.meta.env.PROD;
}

/** User-facing note when optional backend features are unavailable. */
export const BACKEND_UNAVAILABLE_COPY =
  'POS sync, admin AI agents, and proxied market photos need a deployed backend. Everything else runs on Supabase.';

export const getApiBaseUrl = resolveApiBaseUrl;
