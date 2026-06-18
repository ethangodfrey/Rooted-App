import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignup() {
    if (!isSupabaseConfigured) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to web/.env');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      navigate('/app');
      return;
    }

    setMessage('Check your email to confirm your account, then sign in.');
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
      footer={<AuthLink to="/login">Already have an account? Sign in</AuthLink>}
    />
  );
}
