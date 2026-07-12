import { Link } from 'react-router-dom';

import { CredentialManager } from '@/components/trust/CredentialManager';
import { VendorEmpty, VendorFormPanel, VendorHero, VendorScreen } from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function VendorCredentialsPage() {
  const { user } = useAuth();

  return (
    <VendorScreen>
      <Link to="/vendor/compliance" className="app-back-link">
        ← Back
      </Link>
      <VendorHero eyebrow="Trust" title="Verification credentials" />

      {user?.id ? (
        <VendorFormPanel>
          <CredentialManager userId={user.id} />
        </VendorFormPanel>
      ) : (
        <VendorEmpty message="Sign in to manage your credentials." />
      )}
    </VendorScreen>
  );
}
