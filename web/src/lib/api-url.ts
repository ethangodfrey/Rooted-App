const API_PORT = 4000;

/** True when VITE_API_URL is set to an absolute https URL (production / tunnel). */
export function isExplicitPublicApiUrl(): boolean {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim();
  return configured.startsWith('https://');
}

function tryParseHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');

  if (typeof window === 'undefined') {
    return configured;
  }

  const { hostname, protocol } = window.location;
  const onLocalMachine = hostname === 'localhost' || hostname === '127.0.0.1';

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

  return '';
}

export function isApiUrlConfigured(): boolean {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim();
  return configured.length > 0 || import.meta.env.DEV;
}

/** User-facing note when optional backend features are unavailable. */
export const BACKEND_UNAVAILABLE_COPY =
  'POS sync, admin AI agents, and proxied market photos need a deployed backend. Everything else runs on Supabase.';

export const getApiBaseUrl = resolveApiBaseUrl;
