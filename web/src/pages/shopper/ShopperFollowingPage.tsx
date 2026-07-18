import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { SkeletonCard } from '@/components/ui/Skeleton';
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

  async function handleUnfollow(followedProfileId: string) {
    if (!profileId) return;
    setBusyId(followedProfileId);
    try {
      await unfollowVendor(profileId, followedProfileId);
      setVendors((prev) => prev.filter((v) => v.profileId !== followedProfileId));
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
        <div className="flex flex-col gap-3" aria-busy aria-label="Loading following">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} height={72} />
          ))}
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
                  <FallbackImage
                    src={vendor.logoUrl}
                    variant="vendor-logo"
                    label={vendor.businessName ?? undefined}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <div className="min-w-0 flex-1">
                    {vendor.vendorId ? (
                      <Link
                        to={`/vendors/${vendor.vendorId}`}
                        className="app-row-title"
                        style={{ textDecoration: 'none' }}
                      >
                        {vendor.displayName ?? vendor.businessName ?? 'Vendor'}
                      </Link>
                    ) : (
                      <p className="app-row-title" style={{ margin: 0 }}>
                        {vendor.displayName ?? vendor.businessName ?? 'Farmer'}
                      </p>
                    )}
                    <p className="app-row-meta">
                      {[vendor.category, place].filter(Boolean).join(' · ') || 'Local maker'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="app-btn app-btn--ghost app-btn--small"
                    disabled={busyId === vendor.profileId}
                    onClick={() => void handleUnfollow(vendor.profileId)}
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
