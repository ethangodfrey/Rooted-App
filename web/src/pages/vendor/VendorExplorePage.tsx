import { Link } from 'react-router-dom';

import { ExploreShowcaseManager } from '@/components/explore/ExploreShowcaseManager';
import { VendorEmpty, VendorHero, VendorScreen } from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function VendorExplorePage() {
  const { user, vendor } = useAuth();

  return (
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Back
      </Link>
      <VendorHero eyebrow="Growth" title="Explore showcase" />

      {user?.id && vendor?.id ? (
        <ExploreShowcaseManager
          creator={{ creatorType: 'vendor', vendorId: vendor.id }}
          uploaderUserId={user.id}
        />
      ) : (
        <VendorEmpty message="Complete your vendor profile to publish showcase posts." />
      )}
    </VendorScreen>
  );
}
