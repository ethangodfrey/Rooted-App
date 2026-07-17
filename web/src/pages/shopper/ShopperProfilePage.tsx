import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { LegalLinks } from '@/components/account/LegalLinks';
import { ProfilePhoto } from '@/components/ui/ProfilePhoto';
import { UserSticker } from '@/components/ui/UserSticker';
import { useAuth } from '@/hooks/use-auth';
import { fetchFollowedVendors, type FollowedVendor } from '@/lib/follows';
import '@/components/ui/ui.css';
import '@/components/ui/user-sticker.css';

export function ShopperProfilePage() {
  const { user, session, shopper, signOut } = useAuth();
  const [followed, setFollowed] = useState<FollowedVendor[]>([]);

  const displayEmail = user?.email ?? session?.user?.email ?? '—';
  const initials = (user?.name || displayEmail || '?').toString().trim().charAt(0).toUpperCase();
  const displayName = user?.name?.trim() || 'You';
  const interests = shopper?.interests ?? user?.shopper_interests ?? [];

  useEffect(() => {
    const profileId = user?.id ?? session?.user?.id;
    if (!profileId) return;
    void fetchFollowedVendors(profileId)
      .then(setFollowed)
      .catch(() => setFollowed([]));
  }, [user?.id, session?.user?.id]);

  return (
    <div className="app-screen app-screen--narrow app-screen--titled">
      <div className="app-profile-header">
        <ProfilePhoto photoUrl={user?.profile_photo} initials={initials} />
        <div>
          <div className="user-sticker-row" style={{ marginBottom: '0.25rem' }}>
            <p className="app-row-title" style={{ fontSize: '1.125rem', margin: 0 }}>
              {displayName}
            </p>
            <UserSticker role={user?.role ?? 'shopper'} />
          </div>
          <p className="app-row-meta">{displayEmail}</p>
          {user?.shopper_zip_code || shopper?.zip_code || user?.zip_code ? (
            <p className="app-row-meta">
              ZIP {user?.shopper_zip_code || shopper?.zip_code || user?.zip_code}
            </p>
          ) : null}
        </div>
      </div>

      <section style={{ marginBottom: '1.5rem' }}>
        <p className="app-eyebrow">Product interests</p>
        {interests.length === 0 ? (
          <p className="app-row-meta">
            No interests yet —{' '}
            <Link to="/onboarding/interests">add preferences</Link>
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {interests.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-3 py-1 text-xs font-semibold text-orange-200"
                style={{
                  background: '#121A36',
                  border: '1px solid rgba(249, 115, 22, 0.45)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="app-eyebrow" style={{ margin: 0 }}>
            Followed creators
          </p>
          <Link to="/following" className="text-sm font-semibold text-orange-400">
            View all
          </Link>
        </div>
        {followed.length === 0 ? (
          <p className="app-row-meta">
            Not following anyone yet — <Link to="/explore">explore markets</Link>
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {followed.slice(0, 5).map((v) => (
              <li key={v.followId} style={{ marginBottom: '0.5rem' }}>
                <Link to={`/vendors/${v.vendorId}`} className="app-row-title">
                  {v.businessName ?? 'Vendor'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="app-profile-big-cards">
        <Link to="/orders" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            📦
          </span>
          <div>
            <p className="app-profile-big-card__title">Orders</p>
            <p className="app-profile-big-card__meta">Pickup codes and receipts</p>
          </div>
        </Link>

        <Link to="/shopper/saved" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            ♥
          </span>
          <div>
            <p className="app-profile-big-card__title">Saved</p>
            <p className="app-profile-big-card__meta">Vendors, chefs, and products</p>
          </div>
        </Link>

        <Link to="/shopper/profile/edit" className="app-profile-big-card">
          <span className="app-profile-big-card__icon" aria-hidden="true">
            ⚙
          </span>
          <div>
            <p className="app-profile-big-card__title">Settings</p>
            <p className="app-profile-big-card__meta">Profile, ZIP, and preferences</p>
          </div>
        </Link>
      </div>

      <button type="button" className="app-sign-out-link" onClick={signOut}>
        Sign out
      </button>

      <LegalLinks />
      <DeleteAccountSection />
    </div>
  );
}
