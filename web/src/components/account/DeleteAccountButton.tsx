import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { deleteOwnAccount } from '@/lib/delete-account';
import '@/components/ui/ui.css';

export function DeleteAccountButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete your Rooted account permanently? This cannot be undone. Your profile, orders history, and saved vendors will be removed.',
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    const { error: deleteError } = await deleteOwnAccount();
    setLoading(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    navigate('/login');
  }

  return (
    <div className="delete-account">
      <button
        type="button"
        className="app-btn app-btn--danger"
        disabled={loading}
        onClick={handleDelete}
      >
        {loading ? 'Deleting…' : 'Delete account'}
      </button>
      {error ? <p className="app-error" style={{ marginTop: '0.75rem' }}>{error}</p> : null}
      <p className="app-row-meta" style={{ marginTop: '0.5rem' }}>
        Permanently removes your account and profile data.
      </p>
    </div>
  );
}
