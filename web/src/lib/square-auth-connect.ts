import { supabase } from '@/lib/supabase';

/** Public tenant-web origin used for Square OAuth edge routes. */
export function tenantWebBaseUrl(): string | null {
  const configured =
    import.meta.env.VITE_TENANT_WEB_URL?.trim() ||
    import.meta.env.VITE_MARKETS_API_URL?.trim() ||
    '';
  if (configured) return configured.replace(/\/$/, '');

  // Production fallback when Vercel env was not rebuilt with VITE_TENANT_WEB_URL.
  // Prefer setting VITE_TENANT_WEB_URL explicitly on the marketplace project.
  if (import.meta.env.PROD) {
    return 'https://tenant-web-psi.vercel.app';
  }
  return null;
}

export function squareAuthConnectPath(vendorId: string): string | null {
  const base = tenantWebBaseUrl();
  if (!base) return null;
  return `${base}/api/auth/square?vendorId=${encodeURIComponent(vendorId)}`;
}

/**
 * Starts Square OAuth via tenant-web using the current Supabase session.
 * Prefers JSON authorize URL (CORS-safe), then navigates to Square.
 */
export async function startSquareOAuth(vendorId: string): Promise<void> {
  const connectUrl = squareAuthConnectPath(vendorId);
  if (!connectUrl) {
    throw new Error('Set VITE_TENANT_WEB_URL to your tenant-web origin to connect Square.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Sign in again to connect Square.');
  }

  const res = await fetch(`${connectUrl}&format=json`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let detail = `Square connect failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const body = (await res.json()) as { authorizeUrl?: string };
  if (!body.authorizeUrl) {
    throw new Error('Square did not return an authorization URL.');
  }

  window.location.href = body.authorizeUrl;
}
