import { useState } from 'react';

import { formatOAuthError, OAuthConfigError, type OAuthSetupStep } from '@/lib/oauth-errors';
import { signInWithOAuthProvider, type OAuthProvider } from '@/lib/oauth';

interface OAuthButtonsProps {
  disabled?: boolean;
}

export function OAuthButtons({ disabled = false }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupSteps, setSetupSteps] = useState<OAuthSetupStep[] | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setLoadingProvider(provider);
    setError(null);
    setSetupSteps(null);

    try {
      await signInWithOAuthProvider(provider);
    } catch (err) {
      setLoadingProvider(null);
      if (err instanceof OAuthConfigError) {
        setError(err.message);
        setSetupSteps(err.setupSteps);
        return;
      }
      setError(formatOAuthError(err, provider));
    }
  }

  const busy = disabled || loadingProvider !== null;

  return (
    <div className="auth-oauth">
      <p className="auth-oauth__divider">
        <span>or continue with</span>
      </p>

      <button
        type="button"
        className="auth-oauth__btn"
        disabled={busy}
        onClick={() => void handleOAuth('google')}
      >
        {loadingProvider === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <button
        type="button"
        className="auth-oauth__btn auth-oauth__btn--apple"
        disabled={busy}
        onClick={() => void handleOAuth('apple')}
      >
        {loadingProvider === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
      </button>

      {error ? <p className="app-error">{error}</p> : null}
      {setupSteps?.length ? (
        <div className="auth-oauth__setup">
          <p className="auth-oauth__setup-title">Setup checklist</p>
          <ol className="auth-oauth__setup-list">
            {setupSteps.map((step) => (
              <li key={step.label}>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
