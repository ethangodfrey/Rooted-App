import { supabase } from '@/lib/supabase';
import { getApiBaseUrl, isApiUrlConfigured, isExplicitPublicApiUrl } from '@/lib/api-url';

export const isApiConfigured = isApiUrlConfigured();

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const API_URL = getApiBaseUrl();
  if (!API_URL) {
    throw new Error('Backend API is not configured. Set VITE_API_URL.');
  }

  let res: Response;
  try {
    const headers: Record<string, string> = { ...(await authHeaders()) };
    // Only set Content-Type when sending a body — bare GETs with JSON
    // Content-Type force a CORS preflight that fails on unlisted preview hosts.
    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    const hint = isExplicitPublicApiUrl()
      ? 'Check that the backend is deployed and reachable at that URL, and that CORS allows this site origin.'
      : import.meta.env.DEV
        ? `On another device on the same Wi‑Fi, open the site via your PC's network IP (e.g. http://10.0.0.165:5173), start the backend (cd backend && npm run start:dev), and allow port 4000 through Windows Firewall. Off LAN, deploy web + API or set VITE_API_URL to a public HTTPS URL — see docs/OFF_LAN_ACCESS.md.`
        : 'Set VITE_API_URL to your deployed API (e.g. https://rooted-app-production-43fb.up.railway.app). See docs/OFF_LAN_ACCESS.md.';
    throw new Error(`Could not reach the API at ${API_URL}. ${hint}`);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const message = (json as { message?: string | string[] })?.message;
    const flat = Array.isArray(message) ? message.join(', ') : message;
    throw new Error(flat ?? `Request failed (${res.status})`);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
