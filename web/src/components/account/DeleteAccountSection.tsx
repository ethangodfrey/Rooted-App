import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { deleteOwnAccount } from '@/lib/delete-account';

export function DeleteAccountSection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete your account? This permanently removes your profile, orders, and saved data. This cannot be undone.',
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
    <div style={{ marginTop: '2rem' }}>
      <p className="app-eyebrow">Danger zone</p>
      <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
        Permanently delete your account and associated data.
      </p>
      {error ? <p className="app-error">{error}</p> : null}
      <button
        type="button"
        className="app-btn app-btn--secondary"
        disabled={loading}
        onClick={handleDelete}
        style={{ borderColor: 'var(--color-danger, #c0392b)', color: 'var(--color-danger, #c0392b)' }}
      >
        {loading ? 'Deleting…' : 'Delete account'}
      </button>
    </div>
  );
}
