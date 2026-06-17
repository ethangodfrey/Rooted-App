import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthLink } from '@/components/auth/AuthScreen';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { clearPasswordRecovery } = useAuth();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function establishRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Open the reset link from your email, or request a new link.');
        return;
      }

      setReady(true);
      setError(null);
    }

    establishRecoverySession();
  }, []);

  async function handleUpdatePassword() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    clearPasswordRecovery();
    await supabase.auth.signOut();
    setMessage('Password updated. Sign in with your new password.');
    setTimeout(() => navigate('/login'), 1500);
  }

  if (error && !ready) {
    return (
      <div className="app-screen app-screen--narrow" style={{ paddingTop: '4rem' }}>
        <h1 className="app-title">Reset link problem</h1>
        <p className="app-error">{error}</p>
        <button type="button" className="app-btn app-btn--secondary" onClick={() => navigate('/forgot-password')}>
          Request new link
        </button>
        <AuthLink to="/login">Back to sign in</AuthLink>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  return (
    <div className="app-screen app-screen--narrow" style={{ paddingTop: '4rem' }}>
      <p className="app-eyebrow">Rooted</p>
      <h1 className="app-title">Set a new password</h1>
      <p className="app-subtitle">Choose a new password for your account.</p>

      <div className="app-input-group">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          className="app-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          className="app-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat password"
        />
      </div>

      {error ? <p className="app-error">{error}</p> : null}
      {message ? <p className="app-message">{message}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={loading} onClick={handleUpdatePassword}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </div>
  );
}
