import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { assertOAuthAuthorizeUrl, formatOAuthAuthorizeFailure, type OAuthProvider } from '@/lib/oauth-errors';
import { supabase } from '@/lib/supabase';

export type { OAuthProvider } from '@/lib/oauth-errors';

export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  const redirectTo = getAuthRedirectUrl();

  if (!redirectTo.startsWith('http://') && !redirectTo.startsWith('https://')) {
    throw new Error(
      'Invalid OAuth redirect URL. Open the site at http://localhost:5173 or set VITE_APP_URL.',
    );
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw formatOAuthAuthorizeFailure(provider, error.status ?? 400, {
      msg: error.message,
      error: error.message,
      error_code: error.code,
    });
  }
  if (!data?.url) {
    throw formatOAuthAuthorizeFailure(provider, 400, {
      msg: 'Unsupported provider: provider is not enabled',
    });
  }

  await assertOAuthAuthorizeUrl(data.url, provider);
  window.location.assign(data.url);
}
