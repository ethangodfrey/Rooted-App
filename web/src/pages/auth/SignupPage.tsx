import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthLink, AuthScreen } from '@/components/auth/AuthScreen';
import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import { supabase } from '@/lib/supabase';

export function SignupPage() {
  const navigate = useNavigate();
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
      error={error}
      message={message}
      footer={
        <>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', textAlign: 'left', marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              style={{ marginTop: '0.2rem' }}
            />
            <span style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>
              I agree to the{' '}
              <a href={getTermsOfServiceUrl()} target="_blank" rel="noreferrer">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href={getPrivacyPolicyUrl()} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          <AuthLink to="/login">Already have an account? Sign in</AuthLink>
        </>
      }
    />
  );
}
