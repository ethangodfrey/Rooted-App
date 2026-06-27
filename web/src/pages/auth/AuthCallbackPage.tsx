import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { createSessionFromUrl, getOAuthErrorFromUrl } from '@/lib/auth-callback';
import { supabase } from '@/lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const href = window.location.href;
        const oauthError = getOAuthErrorFromUrl(href);
        if (oauthError) {
          throw new Error(oauthError);
        }

        if (href.includes('code=') || href.includes('access_token')) {
          const exchanged = await createSessionFromUrl(href);
          if (!exchanged) {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              throw new Error('Sign-in session was not created. Try again.');
            }
          }
        }

        await refreshUser();
        navigate('/app', { replace: true });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not complete sign-in. Try signing in manually.',
        );
      }
    }

    void handleCallback();
  }, [navigate, refreshUser]);

  if (error) {
    return (
      <div className="app-screen app-screen--narrow">
        <p className="app-error">{error}</p>
        <Link to="/login" className="auth-screen__link" style={{ display: 'block', marginTop: '1rem' }}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="app-loading">
      <div className="app-spinner" />
      <p style={{ marginTop: '1rem', color: 'var(--color-muted)' }}>Completing sign-in…</p>
    </div>
  );
}
