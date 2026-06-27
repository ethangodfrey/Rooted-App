import { Link } from 'react-router-dom';

import { CredentialManager } from '@/components/trust/CredentialManager';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function ChefCredentialsPage() {
  const { user } = useAuth();

  return (
    <div className="app-screen">
      <Link to="/chef/dashboard" className="app-back-link">
        ← Back
      </Link>
      <p className="app-eyebrow">Trust & verification</p>
      <h1 className="app-title">Verification credentials</h1>
      <p className="app-subtitle">
        Upload documents for admin review. Verified credentials appear as trust badges on your
        profile.
      </p>

      {user?.id ? (
        <CredentialManager userId={user.id} />
      ) : (
        <p className="app-row-meta">Sign in to manage your credentials.</p>
      )}
    </div>
  );
}
