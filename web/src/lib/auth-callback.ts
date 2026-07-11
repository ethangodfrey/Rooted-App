import { formatOAuthError, formatOAuthUrlError } from '@/lib/oauth-errors';
import { supabase } from '@/lib/supabase';

/** Parse query-string and hash params (Supabase PKCE uses ?code=, errors may appear in either). */
export function getParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    new URLSearchParams(hash).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    // Fallback for non-standard URLs.
  }

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramString =
    hashIndex >= 0
      ? url.substring(hashIndex + 1)
      : queryIndex >= 0
        ? url.substring(queryIndex + 1)
        : '';

  new URLSearchParams(paramString).forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

export function getOAuthErrorFromUrl(url: string): string | null {
  const params = getParamsFromUrl(url);
  if (!params.error) return null;
  return formatOAuthUrlError(params.error, params.error_description);
}

export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = getParamsFromUrl(url);

  if (params.error) {
    throw new Error(formatOAuthUrlError(params.error, params.error_description));
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(formatOAuthError(error));
    return true;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new Error(formatOAuthError(error));
    return true;
  }

  return false;
}
