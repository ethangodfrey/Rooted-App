import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { deleteOwnAccount } from '@/lib/delete-account';
import { getPrivacyPolicyUrl, getSupportUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import '@/components/ui/ui.css';

export function AccountSettingsSection() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Delete your account permanently? This removes your profile, orders, and saved data. This cannot be undone.',
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    const { error: deleteError } = await deleteOwnAccount();
    setDeleting(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    navigate('/');
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <p className="app-eyebrow">Legal &amp; support</p>
      <div className="app-list" style={{ marginBottom: '1rem' }}>
        <a className="app-card app-card--pressable" href={getPrivacyPolicyUrl()} target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        <a className="app-card app-card--pressable" href={getTermsOfServiceUrl()} target="_blank" rel="noreferrer">
          Terms of Service
        </a>
        <a className="app-card app-card--pressable" href={getSupportUrl()} target="_blank" rel="noreferrer">
          Support
        </a>
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button
        type="button"
        className="app-btn app-btn--secondary"
        style={{ color: 'var(--color-danger, #b42318)' }}
        disabled={deleting}
        onClick={handleDeleteAccount}
      >
        {deleting ? 'Deleting…' : 'Delete my account'}
      </button>
    </div>
  );
}
