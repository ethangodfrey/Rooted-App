import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const isApiConfigured = API_URL.length > 0;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

function jwtAlg(token: string): string | null {
  try {
    const header = token.split('.')[0];
    if (!header) return null;
    const json = atob(header.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { alg?: string }).alg ?? null;
  } catch {
    return null;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;
  if (!session?.access_token) return {};

  const expiresAt = session.expires_at ?? 0;
  const expiresSoon = expiresAt < Math.floor(Date.now() / 1000) + 120;
  const legacyHs256 = jwtAlg(session.access_token) === 'HS256';

  // Refresh stale HS256 sessions (pre-migration) or tokens close to expiry.
  if (session.refresh_token && (expiresSoon || legacyHs256)) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }

  const token = session.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (!isApiConfigured) {
    throw new Error('Backend API is not configured. Set EXPO_PUBLIC_API_URL.');
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? safeParse(text) : null;

  if (!res.ok) {
    const message = (json as { message?: string | string[] })?.message;
    const flat = Array.isArray(message) ? message.join(', ') : message;
    throw new Error(flat ?? `Request failed (${res.status})`);
  }

  return json as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
