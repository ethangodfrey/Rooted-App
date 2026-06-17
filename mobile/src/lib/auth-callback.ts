import { supabase } from '@/src/lib/supabase';

export function getParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
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

export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = getParamsFromUrl(url);

  if (params.error) {
    throw new Error(params.error_description ?? params.error);
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

export function isRecoveryUrl(url: string): boolean {
  const params = getParamsFromUrl(url);
  return params.type === 'recovery';
}

export function isAuthUrl(url: string): boolean {
  return (
    url.includes('access_token') ||
    url.includes('refresh_token') ||
    url.includes('code=') ||
    url.includes('auth/callback') ||
    url.includes('auth/reset-password')
  );
}
