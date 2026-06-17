const API_PORT = 4000;

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
    const configHost = tryParseHostname(configured);
    const pointsToLocalhost = configHost === 'localhost' || configHost === '127.0.0.1';
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

export const getApiBaseUrl = resolveApiBaseUrl;
