const API_PORT = 4000;

/**
 * Live Railway public URL. Used when `api.vendorlymarketplace.app` DNS is not configured
 * (or as a production fallback). Prefer a custom domain once DNS points at Railway.
 */
export const RAILWAY_PUBLIC_API_URL =
  'https://rooted-app-production-43fb.up.railway.app';

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

function isLoopbackHostname(hostname: string | null): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function logApiUrlResolved(source: string, url: string): void {
  // eslint-disable-next-line no-console
  console.log(`API_URL_RESOLVED SOURCE=${source} URL=${url}`);
}

function logLocalhostEliminated(rejected: string, replacement: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `LOCALHOST_FETCH_ELIMINATED REJECTED=${rejected} REPLACED_WITH=${replacement}`,
  );
}

export function resolveApiBaseUrl(): string {
  const rawConfigured = (
    import.meta.env.VITE_API_URL ??
    import.meta.env.NEXT_PUBLIC_API_URL ??
    ''
  )
    .trim()
    .replace(/\/$/, '');
  const configured = normalizeConfiguredApiUrl(rawConfigured);
  const configuredIsLoopback = isLoopbackHostname(tryParseHostname(configured));

  if (typeof window === 'undefined') {
    // SSR / build: never keep loopback when producing a production bundle.
    if (configured && !(import.meta.env.PROD && configuredIsLoopback)) {
      return configured;
    }
    if (import.meta.env.PROD) {
      if (configuredIsLoopback) {
        logLocalhostEliminated(configured, RAILWAY_PUBLIC_API_URL);
      }
      logApiUrlResolved('RAILWAY_FALLBACK', RAILWAY_PUBLIC_API_URL);
      return RAILWAY_PUBLIC_API_URL;
    }
    return configured || '';
  }

  const { hostname, protocol } = window.location;
  const onLocalMachine = isLoopbackHostname(hostname);

  if (configured) {
    // Production site must never call loopback even if env was mis-set.
    if (import.meta.env.PROD && configuredIsLoopback && !onLocalMachine) {
      logLocalhostEliminated(configured, RAILWAY_PUBLIC_API_URL);
      logApiUrlResolved('RAILWAY_FALLBACK', RAILWAY_PUBLIC_API_URL);
      return RAILWAY_PUBLIC_API_URL;
    }

    // HTTPS or any non-localhost URL: always honor env (works off LAN / cellular).
    if (configured.startsWith('https://')) {
      return configured;
    }
    // LAN dev: localhost in .env but browser opened at 192.168.x.x → same machine :4000
    if (!onLocalMachine && configuredIsLoopback) {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
    return configured;
  }

  if (import.meta.env.DEV) {
    return `${protocol}//${hostname}:${API_PORT}`;
  }

  // Production builds without VITE_API_URL still need the live Railway API.
  logApiUrlResolved('RAILWAY_FALLBACK', RAILWAY_PUBLIC_API_URL);
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
