import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { fetchFollowedVendors, unfollowVendor, type FollowedVendor } from '@/lib/follows';
import '@/components/ui/ui.css';

export function ShopperFollowingPage() {
  const { user, session } = useAuth();
  const profileId = user?.id ?? session?.user?.id ?? null;
  const [vendors, setVendors] = useState<FollowedVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!profileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchFollowedVendors(profileId)
      .then((rows) => {
        if (active) {
          setVendors(rows);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load following');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  async function handleUnfollow(vendorId: string) {
    if (!profileId) return;
    setBusyId(vendorId);
    try {
      await unfollowVendor(profileId, vendorId);
      setVendors((prev) => prev.filter((v) => v.vendorId !== vendorId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to unfollow');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Following</h1>
      <p className="app-subtitle">Creators you follow — updates and shortcuts live here.</p>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : vendors.length === 0 ? (
        <div className="app-empty" style={{ textAlign: 'left' }}>
          <p style={{ margin: '0 0 0.75rem' }}>You are not following anyone yet.</p>
          <Link to="/explore" className="app-btn app-btn--primary">
            Discover vendors
          </Link>
        </div>
      ) : (
        <ul className="app-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {vendors.map((vendor) => {
            const place = [vendor.sellCity, vendor.sellState].filter(Boolean).join(', ');
            return (
              <li key={vendor.followId} className="app-card" style={{ marginBottom: '0.75rem' }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#121A36] text-sm font-bold text-orange-300"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {vendor.logoUrl ? (
                      <img
                        src={vendor.logoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (vendor.businessName ?? '?').slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/vendors/${vendor.vendorId}`}
                      className="app-row-title"
                      style={{ textDecoration: 'none' }}
                    >
                      {vendor.businessName ?? 'Vendor'}
                    </Link>
                    <p className="app-row-meta">
                      {[vendor.category, place].filter(Boolean).join(' · ') || 'Local maker'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="app-btn app-btn--ghost app-btn--small"
                    disabled={busyId === vendor.vendorId}
                    onClick={() => void handleUnfollow(vendor.vendorId)}
                  >
                    Unfollow
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
