import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthLink, AuthScreen } from '@/src/components/auth/auth-screen';
import { Text } from '@/src/components/ui/text';
import { getAuthRedirectUrl } from '@/src/lib/auth-redirect';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/src/lib/legal-urls';
import { supabase } from '@/src/lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignup() {
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace('/');
      return;
    }

    setMessage('Check your email to confirm your account, then sign in.');
  }

  return (
    <AuthScreen
      title="Join Rooted"
      subtitle="Discover local events and reserve pickup from nearby vendors."
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSignup}
      submitLabel="Create account"
      loading={loading}
      error={error}
      message={message}
      footer={
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            className="mt-4 flex-row items-start gap-3"
            onPress={() => setAcceptedTerms((value) => !value)}>
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                acceptedTerms ? 'border-primary bg-primary' : 'border-muted bg-white'
              }`}>
              {acceptedTerms ? <Text className="text-xs text-white">✓</Text> : null}
            </View>
            <Text className="flex-1 text-sm leading-5 text-subtle">
              I agree to the{' '}
              <Text
                className="text-sm text-primary"
                onPress={() => WebBrowser.openBrowserAsync(getTermsOfServiceUrl())}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                className="text-sm text-primary"
                onPress={() => WebBrowser.openBrowserAsync(getPrivacyPolicyUrl())}>
                Privacy Policy
              </Text>
              .
            </Text>
          </Pressable>
          <AuthLink href="/(auth)/login">Already have an account? Sign in</AuthLink>
        </>
      }
    />
  );
}
