import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignup() {
    if (!accepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
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
    } else if (password.length < 8) {
      nextFieldErrors.password = 'Password must be at least 8 characters.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
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
      title="Join Vendorly"
      subtitle="Your local food marketplace — farmers markets, private chefs, and home cooks in one place."
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
      onSubmit={handleSignup}
      submitLabel="Create account"
      loading={loading}
      submitDisabled={!accepted}
      error={error}
      fieldErrors={fieldErrors}
      message={message}
      beforeSubmit={
        <div className="app-consent">
          <input
            id="legal-consent"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <label htmlFor="legal-consent">
            I agree to the{' '}
            <Link to="/legal/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            .
          </label>
        </div>
      }
      socialAuth={<OAuthButtons disabled={loading} />}
      footer={<AuthLink to="/login">Already have an account? Sign in</AuthLink>}
    />
  );
}
