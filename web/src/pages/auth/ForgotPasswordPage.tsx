import { useState } from 'react';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { getPasswordResetRedirectUrl } from '@/lib/auth-redirect';
import { supabase } from '@/lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage('Reset link sent. Open the email and tap the link to set a new password.');
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
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    />
  );
}
