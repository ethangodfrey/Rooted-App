import { Link } from 'react-router-dom';

import { PosActivityDashboard } from '@/components/vendor/PosActivityDashboard';
import { VendorFormPanel, VendorHero, VendorScreen } from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { BACKEND_UNAVAILABLE_COPY } from '@/lib/api-url';
import '@/components/ui/ui.css';

export function VendorPosActivityPage() {
  const { vendor } = useAuth();

  if (!isApiConfigured) {
    return (
      <VendorScreen>
        <Link to="/vendor/pos" className="app-back-link">
          ← POS
        </Link>
        <VendorHero eyebrow="Vendor" title="POS activity" />
        <VendorFormPanel>
          <p className="m-0 text-sm font-semibold text-stone-800">Dashboard unavailable</p>
          <p className="m-0 mt-1 text-xs text-stone-500">{BACKEND_UNAVAILABLE_COPY}</p>
        </VendorFormPanel>
      </VendorScreen>
    );
  }

  if (!vendor) {
    return (
      <VendorScreen>
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <Link to="/vendor/pos" className="app-back-link">
        ← POS
      </Link>
      <VendorHero eyebrow="Vendor" title="POS activity" subtitle="Inventory syncs and queue health" />

      <VendorFormPanel className="mt-2">
        <PosActivityDashboard vendorId={vendor.id} />
      </VendorFormPanel>
    </VendorScreen>
  );
}
