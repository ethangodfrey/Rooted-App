import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { useSavedVendors } from '@/hooks/use-saved-vendors';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { LegalLinks } from '@/components/account/LegalLinks';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ShopperProfilePage() {
  const { user, session, signOut } = useAuth();
  const { saved } = useSavedVendors();
  const [vendors, setVendors] = useState<{ id: string; business_name: string | null; category: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const displayEmail = user?.email ?? session?.user?.email ?? '—';
  const initials = (user?.name || displayEmail || '?').toString().trim().charAt(0).toUpperCase();

  useEffect(() => {
    async function load() {
      if (saved.length === 0) {
        setVendors([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase.from('vendors').select('id, business_name, category').in('id', saved);
      setVendors(data ?? []);
      setLoading(false);
    }
    load();
  }, [saved]);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Account</p>
      <h1 className="app-title">Profile</h1>

      <div className="app-card profile-summary-card">
        <div className="app-row">
          {user?.profile_photo ? (
            <img src={user.profile_photo} alt="" className="profile-avatar profile-avatar--small" />
          ) : (
            <div className="profile-avatar profile-avatar--small profile-avatar--placeholder">
              {initials}
            </div>
          )}
          <div className="app-row-body">
            <p className="app-row-title">{user?.name?.trim() || 'Shopper'}</p>
            <p className="app-row-meta">{displayEmail}</p>
            {user?.phone ? <p className="app-row-meta">{user.phone}</p> : null}
          </div>
        </div>
        <Link to="/shopper/profile/edit" className="app-btn app-btn--secondary" style={{ marginTop: '1rem' }}>
          Edit profile
        </Link>
      </div>

      <Link to="/shopper/orders" className="app-card app-card--pressable" style={{ marginBottom: '1rem', display: 'block' }}>
        <p className="app-row-title">My reservations</p>
        <p className="app-row-meta">Track your reserve-for-pickup orders.</p>
      </Link>

      <Link to="/shopper/leftovers" className="app-card app-card--pressable app-card--honeydew" style={{ marginBottom: '1.5rem', display: 'block' }}>
        <p className="app-row-title">Leftovers near you</p>
        <p className="app-row-meta">Browse post-market deals from local vendors.</p>
      </Link>

      <div className="profile-section-header">
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Saved vendors</h2>
        {vendors.length > 0 ? (
          <Link to="/shopper/profile/edit" className="profile-manage-link">
            Manage
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : vendors.length === 0 ? (
        <p className="app-row-meta">Tap the heart on a vendor&apos;s page to save them here.</p>
      ) : (
        <div className="app-list">
          {vendors.slice(0, 5).map((vendor) => (
            <Link key={vendor.id} to={`/shopper/vendors/${vendor.id}`} className="app-card app-card--pressable app-row">
              <div className="app-row-icon">🏪</div>
              <div className="app-row-body">
                <p className="app-row-title">{vendor.business_name ?? 'Vendor'}</p>
                {vendor.category ? <p className="app-row-meta">{vendor.category}</p> : null}
              </div>
            </Link>
          ))}
          {vendors.length > 5 ? (
            <Link to="/shopper/profile/edit" className="profile-manage-link" style={{ textAlign: 'center', display: 'block' }}>
              View all {vendors.length} saved vendors
            </Link>
          ) : null}
        </div>
      )}

      <button type="button" className="app-btn app-btn--secondary" style={{ marginTop: '2rem' }} onClick={signOut}>
        Sign out
      </button>

      <LegalLinks />
      <DeleteAccountSection />
    </div>
  );
}
