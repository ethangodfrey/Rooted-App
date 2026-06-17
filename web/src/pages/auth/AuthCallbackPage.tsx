import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        await refreshUser();
        navigate('/app', { replace: true });
      } catch {
        setError('Could not complete sign-in. Try signing in manually.');
      }
    }

    const timer = setTimeout(handleCallback, 500);
    return () => clearTimeout(timer);
  }, [navigate, refreshUser]);

  if (error) {
    return (
      <div className="app-screen app-screen--narrow">
        <p className="app-error">{error}</p>
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
