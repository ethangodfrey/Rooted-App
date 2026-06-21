import { router } from 'expo-router';
import { useState } from 'react';

import { TermsConsent } from '@/src/components/auth/auth-legal-notice';
import { AuthLink, AuthScreen } from '@/src/components/auth/auth-screen';
import { getAuthRedirectUrl } from '@/src/lib/auth-redirect';
import { supabase } from '@/src/lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSignup() {
    if (!acceptedTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
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
          <TermsConsent checked={acceptedTerms} onChange={setAcceptedTerms} />
          <AuthLink href="/(auth)/login">Already have an account? Sign in</AuthLink>
        </>
      }
    />
  );
}
