import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { getOAuthErrorFromUrl } from '@/lib/auth-callback';
import { getAuthRedirectUrlForDisplay } from '@/lib/auth-redirect';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return (
      <div className="auth-screen">
        <div className="auth-screen__inner">
          <Link to="/" className="auth-home-link">← Back to home</Link>
          <h1 className="app-title">Supabase not configured</h1>
          <p className="app-subtitle">
            Copy web/.env.example to web/.env and add your Supabase project URL and anon key.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to explore farmers markets, private chefs, and local food businesses."
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
      submitLabel="Sign in"
      loading={loading}
      error={error}
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
