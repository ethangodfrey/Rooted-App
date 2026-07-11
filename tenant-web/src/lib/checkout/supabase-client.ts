export interface SupabaseUserIdentity {
  id: string;
  email?: string;
}

function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

/** Verify a Supabase access token and return the user id. */
export async function verifySupabaseAccessToken(
  token: string,
): Promise<SupabaseUserIdentity | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const res = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: config.anonKey,
    },
  });

  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id) return null;
  return { id: user.id, email: user.email };
}

/** Invoke a Supabase RPC using the shopper's bearer token. */
export async function supabaseRpc<T>(
  token: string,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const config = supabaseConfig();
  if (!config) {
    return { data: null, error: 'Supabase is not configured', status: 503 };
  }

  const res = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });

  const text = await res.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message =
      (data as { message?: string } | null)?.message ??
      (data as { error?: string } | null)?.error ??
      text.slice(0, 200) ??
      `RPC ${functionName} failed`;
    return { data: null, error: message, status: res.status };
  }

  return { data, error: null, status: res.status };
}
