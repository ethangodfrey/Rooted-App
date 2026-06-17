import { useState } from 'react';
import { View } from 'react-native';

import { AuthLink, AuthScreen } from '@/src/components/auth/auth-screen';
import { Text } from '@/src/components/ui/text';
import {
  getAuthRedirectUrlForDisplay,
  getHostedAuthRedirectUrl,
  getPasswordResetRedirectUrl,
} from '@/src/lib/auth-redirect';
import { supabase } from '@/src/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const usingHostedRedirect = getHostedAuthRedirectUrl() !== null;

  async function handleReset() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const redirectTo = getPasswordResetRedirectUrl();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage(
      usingHostedRedirect
        ? 'Reset link sent. Open the email on this phone, tap the link, then set your new password in the app.'
        : 'Reset link sent. If the link shows a blank error page, configure the hosted redirect (see note below) and request a new link.',
    );
  }

  return (
    <AuthScreen
      title="Reset password"
      subtitle="Enter your email and we will send a reset link."
      email={email}
      password=""
      onEmailChange={setEmail}
      onPasswordChange={() => {}}
      showPassword={false}
      onSubmit={handleReset}
      submitLabel="Send reset link"
      loading={loading}
      error={error}
      message={message}
      footer={
        <View className="mt-2 w-full">
          {!usingHostedRedirect ? (
            <Text className="mb-3 text-center text-[13px] leading-[18px] text-warn">
              Email links need a hosted redirect page. Upload docs/supabase/auth-redirect.html to
              Supabase Storage (bucket: auth), set EXPO_PUBLIC_AUTH_REDIRECT_URL in mobile/.env, and
              add that URL under Authentication → URL Configuration → Redirect URLs.
            </Text>
          ) : null}
          <Text className="mb-1 text-center text-xs text-subtle">Redirect URL in use:</Text>
          <Text className="mb-2 text-center text-[11px] text-muted" selectable>
            {getAuthRedirectUrlForDisplay()}
          </Text>
          <AuthLink href="/(auth)/login">Back to sign in</AuthLink>
        </View>
      }
    />
  );
}
