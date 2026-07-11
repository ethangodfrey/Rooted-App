import { Link } from 'react-router-dom';

import { ExploreShowcaseManager } from '@/components/explore/ExploreShowcaseManager';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function VendorExplorePage() {
  const { user, vendor } = useAuth();

  return (
    <div className="app-screen">
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Back
      </Link>
      <p className="app-eyebrow">Explore showcase</p>
      <h1 className="app-title">Showcase your work</h1>
      <p className="app-subtitle">
        Publish portfolio pieces, behind-the-scenes, and promotions to the customer Explore feed.
      </p>

      {user?.id && vendor?.id ? (
        <ExploreShowcaseManager
          creator={{ creatorType: 'vendor', vendorId: vendor.id }}
          uploaderUserId={user.id}
        />
      ) : (
        <p className="app-row-meta">Complete your vendor profile to publish showcase posts.</p>
      )}
    </div>
  );
}
