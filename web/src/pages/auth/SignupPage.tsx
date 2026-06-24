import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { supabase } from '@/lib/supabase';

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignup() {
    if (!accepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
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
      submitDisabled={!accepted}
      error={error}
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
      footer={<AuthLink to="/login">Already have an account? Sign in</AuthLink>}
    />
  );
}
