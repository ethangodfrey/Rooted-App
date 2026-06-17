import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { formatExpiresIn, type LeftoverListing } from '@/lib/leftovers';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function VendorLeftoversPage() {
  const { vendor } = useAuth();
  const [listings, setListings] = useState<LeftoverListing[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!vendor) return;
    setLoading(true);
    const { data } = await supabase
      .from('leftover_listings')
      .select('id, title, price_cents, quantity_remaining, expires_at, status, created_at')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setListings((data as LeftoverListing[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [vendor]);

  async function cancelListing(id: string) {
    await supabase
      .from('leftover_listings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  }

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Post-market</p>
      <h1 className="app-title">Leftovers</h1>
      <p className="app-row-meta" style={{ marginBottom: '1rem' }}>
        Manage post-market deals. Listings expire automatically based on the window you choose.
      </p>

      <Link to="/vendor/leftovers/new" className="app-btn app-btn--primary" style={{ display: 'inline-block', marginBottom: '1rem' }}>
        + List leftovers
      </Link>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : listings.length === 0 ? (
        <div className="app-card">
          <p className="app-row-title">No leftovers listed</p>
          <p className="app-row-meta">
            After a market day, list unsold bread, produce, or crafts before they go to waste.
          </p>
        </div>
      ) : (
        <div className="app-list">
          {listings.map((listing) => {
            const hoursLeft = Math.max(
              0,
              (new Date(listing.expires_at).getTime() - Date.now()) / (1000 * 60 * 60),
            );
            return (
              <div key={listing.id} className="app-card">
                <p className="app-row-title">{listing.title}</p>
                <p className="app-row-meta">
                  {formatPrice(listing.price_cents)} · {listing.quantity_remaining} left · {listing.status}
                  {listing.status === 'active' ? ` · ${formatExpiresIn(hoursLeft)}` : ''}
                </p>
                {listing.status === 'active' ? (
                  <button type="button" className="app-btn app-btn--secondary" style={{ marginTop: '0.5rem' }} onClick={() => cancelListing(listing.id)}>
                    Cancel listing
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
