import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { SupabaseConfigNotice } from '@/components/auth/SupabaseConfigNotice';
import { getOAuthErrorFromUrl } from '@/lib/auth-callback';
import { getAuthRedirectUrlForDisplay } from '@/lib/auth-redirect';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const oauthError = getOAuthErrorFromUrl(window.location.href);
    if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  async function handleLogin() {
    if (!isSupabaseConfigured) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to web/.env');
      return;
    }

    const nextFieldErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      nextFieldErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextFieldErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextFieldErrors.password = 'Password is required.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate('/app');
  }

  if (!isSupabaseConfigured) {
    return <SupabaseConfigNotice />;
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to explore farmers markets, private chefs, and local food businesses."
      email={email}
      password={password}
      onEmailChange={(value) => {
        setEmail(value);
        setFieldErrors((prev) => {
          if (!prev.email) return prev;
          const next = { ...prev };
          delete next.email;
          return next;
        });
      }}
      onPasswordChange={(value) => {
        setPassword(value);
        setFieldErrors((prev) => {
          if (!prev.password) return prev;
          const next = { ...prev };
          delete next.password;
          return next;
        });
      }}
      onSubmit={handleLogin}
      submitLabel="Sign in"
      loading={loading}
      error={error}
      fieldErrors={fieldErrors}
      message={
        import.meta.env.DEV
          ? `OAuth redirect: ${getAuthRedirectUrlForDisplay()}`
          : null
      }
      socialAuth={<OAuthButtons disabled={loading} />}
      footer={
        <>
          <AuthLink to="/forgot-password">Forgot password?</AuthLink>
          <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    />
  );
}
