import { useState } from 'react';
import { Link } from 'react-router-dom';

import { deleteOwnAccount } from '@/lib/delete-account';
import {
  getPrivacyPolicyUrl,
  getSupportUrl,
  getTermsOfServiceUrl,
} from '@/lib/legal-urls';
import '@/components/ui/ui.css';

interface AccountLegalSectionProps {
  onAccountDeleted?: () => void;
}

export function AccountLegalSection({ onAccountDeleted }: AccountLegalSectionProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete your Rooted account permanently? This removes your profile and saved data and cannot be undone.',
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

    onAccountDeleted?.();
  }

  return (
    <section className="account-legal" style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Legal & support</h2>
      <div className="app-list" style={{ marginBottom: '1rem' }}>
        <a href={getPrivacyPolicyUrl()} className="app-row-meta" style={{ display: 'block' }}>
          Privacy policy
        </a>
        <a href={getTermsOfServiceUrl()} className="app-row-meta" style={{ display: 'block' }}>
          Terms of service
        </a>
        <a href={getSupportUrl()} className="app-row-meta" style={{ display: 'block' }}>
          Contact support
        </a>
      </div>

      <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
        You can permanently delete your account and associated data at any time.
      </p>
      {error ? <p className="app-error">{error}</p> : null}
      <button
        type="button"
        className="app-btn app-btn--secondary"
        disabled={deleting}
        onClick={handleDelete}
      >
        {deleting ? 'Deleting…' : 'Delete my account'}
      </button>
    </section>
  );
}

export function AuthLegalNotice() {
  return (
    <p className="auth-legal-notice">
      By continuing, you agree to our{' '}
      <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
    </p>
  );
}
