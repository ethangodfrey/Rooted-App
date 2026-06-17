import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { DiscoverThumb } from '@/components/discover/DiscoverThumb';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { fetchCuratedLeftovers, formatExpiresIn, type CuratedLeftover } from '@/lib/leftovers';
import { pickListingDisplayImage } from '@/lib/product-image';
import '@/components/ui/ui.css';

export function ShopperLeftoversPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<CuratedLeftover[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCuratedLeftovers({ userCity: user?.city, userState: user?.state })
      .then(setListings)
      .finally(() => setLoading(false));
  }, [user?.city, user?.state]);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Near you</p>
      <h1 className="app-title">Market leftovers</h1>
      <p className="app-row-meta" style={{ marginBottom: '1rem' }}>
        Sorted by time left and pickup distance.
      </p>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : listings.length === 0 ? (
        <div className="app-empty">No active leftovers nearby right now.</div>
      ) : (
        <div className="app-list">
          {listings.map((listing) => (
            <Link key={listing.id} to={`/shopper/leftovers/${listing.id}`} className="app-card app-card--pressable app-row">
              <DiscoverThumb
                imageUrl={pickListingDisplayImage(listing.media_url)}
                category={listing.vendor?.category ?? 'Food & Drink'}
              />
              <div className="app-row-body">
                  <p className="app-row-title">{listing.title}</p>
                  <p className="app-row-meta">
                    {listing.vendor?.business_name} · {formatPrice(listing.price_cents)}
                  </p>
                  <p className="app-row-meta" style={{ color: 'var(--color-warn)' }}>
                    {formatExpiresIn(listing.hoursLeft)} · {listing.quantity_remaining} left
                  </p>
                  <p className="app-row-meta">
                    {listing.locationLabel}
                    {listing.distanceMiles != null ? ` · ${formatDistance(listing.distanceMiles)}` : ''}
                  </p>
                </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
