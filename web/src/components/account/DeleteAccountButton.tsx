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
      'Delete your account permanently? This removes all your data and cannot be undone.',
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
    <div style={{ marginTop: '1rem' }}>
      {error ? <p className="app-error">{error}</p> : null}
      <button
        type="button"
        className="app-btn app-btn--secondary"
        disabled={loading}
        onClick={handleDelete}
        style={{ color: 'var(--color-danger, #b91c1c)' }}>
        {loading ? 'Deleting…' : 'Delete account'}
      </button>
    </div>
  );
}
