import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="app-screen app-screen--narrow">
        <Link to="/" className="auth-home-link">← Back to home</Link>
        <h1 className="app-title">Supabase not configured</h1>
        <p className="app-subtitle">
          Copy web/.env.example to web/.env and add your Supabase project URL and anon key.
        </p>
      </div>
    );
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to discover local markets and vendors."
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
      submitLabel="Sign in"
      loading={loading}
      error={error}
      footer={
        <>
          <AuthLink to="/forgot-password">Forgot password?</AuthLink>
          <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    />
  );
}
