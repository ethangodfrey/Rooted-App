import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function VendorProfilePage() {
  const { user, vendor, signOut } = useAuth();

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Account</p>
      <h1 className="app-title">Profile</h1>

      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        <p className="app-row-meta">Email</p>
        <p className="app-row-title">{user?.email}</p>
        <p className="app-row-meta" style={{ marginTop: '1rem' }}>Business</p>
        <p className="app-row-title">{vendor?.business_name ?? '—'}</p>
        <p className="app-row-meta" style={{ marginTop: '1rem' }}>Status</p>
        <p className="app-row-title" style={{ textTransform: 'capitalize' }}>{vendor?.approval_status}</p>
      </div>

      <div className="app-list">
        <Link to="/vendor/storefront" className="app-card app-card--pressable">Edit storefront</Link>
        <Link to="/vendor/preview" className="app-card app-card--pressable">Preview shop</Link>
        <Link to="/vendor/setup" className="app-card app-card--pressable">Application details</Link>
        <Link to="/vendor/events" className="app-card app-card--pressable">My events</Link>
        <Link to="/vendor/pos" className="app-card app-card--pressable">Point of Sale</Link>
      </div>

      <button type="button" className="app-btn app-btn--secondary" style={{ marginTop: '2rem' }} onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
