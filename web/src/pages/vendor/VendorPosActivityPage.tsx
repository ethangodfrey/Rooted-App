import { Link } from 'react-router-dom';

import { PosActivityDashboard } from '@/components/vendor/PosActivityDashboard';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { BACKEND_UNAVAILABLE_COPY } from '@/lib/api-url';
import '@/components/ui/ui.css';

export function VendorPosActivityPage() {
  const { vendor } = useAuth();

  if (!isApiConfigured) {
    return (
      <div className="app-screen">
        <Link to="/vendor/pos" className="app-back-link">
          ← POS
        </Link>
        <h1 className="app-title">POS activity</h1>
        <div className="app-card app-card--honeydew">
          <p className="app-row-title">Dashboard unavailable</p>
          <p className="app-row-meta">{BACKEND_UNAVAILABLE_COPY}</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="app-screen">
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <Link to="/vendor/pos" className="app-back-link">
        ← POS
      </Link>
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">POS activity</h1>
      <p className="app-subtitle">Live inventory syncs, sales, and queue health.</p>

      <div className="mt-6 rounded-3xl bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6 ring-1 ring-slate-200/80">
        <PosActivityDashboard vendorId={vendor.id} />
      </div>
    </div>
  );
}
