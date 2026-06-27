import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { createSessionFromUrl } from '@/src/lib/auth-callback';
import { getAuthRedirectUrl } from '@/src/lib/auth-redirect';
import {
  assertOAuthAuthorizeUrl,
  formatOAuthAuthorizeFailure,
  formatOAuthError,
  type OAuthProvider,
} from '@/src/lib/oauth-error';
import { supabase } from '@/src/lib/supabase';

export type { OAuthProvider } from '@/src/lib/oauth-error';

async function signInWithOAuthBrowser(provider: Exclude<OAuthProvider, never>): Promise<boolean> {
  const redirectTo = getAuthRedirectUrl();

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

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  await createSessionFromUrl(result.url);
  return true;
}

export async function signInWithGoogle(): Promise<boolean> {
  return signInWithOAuthBrowser('google');
}

export async function signInWithApple(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const available = await AppleAuthentication.isAvailableAsync();
    if (available) {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token from Apple.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw new Error(formatOAuthError(error, 'apple'));
      return true;
    }
  }

  return signInWithOAuthBrowser('apple');
}
