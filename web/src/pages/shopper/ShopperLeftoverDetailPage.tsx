import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { DiscoverThumb } from '@/components/discover/DiscoverThumb';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import {
  curateLeftovers,
  fetchLeftoverById,
  formatExpiresIn,
  type CuratedLeftover,
} from '@/lib/leftovers';
import { pickListingDisplayImage } from '@/lib/product-image';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ShopperLeftoverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<CuratedLeftover | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchLeftoverById(id).then((row) => {
      if (!row) {
        setListing(null);
      } else {
        const [curated] = curateLeftovers([row], {
          userCity: user?.city,
          userState: user?.state,
        });
        setListing(curated ?? null);
      }
      setLoading(false);
    });
  }, [id, user?.city, user?.state]);

  async function handleReserve() {
    if (!listing) return;
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_leftover_reservation', {
      p_leftover_id: listing.id,
      p_quantity: quantity,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    navigate(`/shopper/orders/${data as string}`);
  }

  if (loading) {
    return <div className="app-loading"><div className="app-spinner" /></div>;
  }

  if (!listing) {
    return <div className="app-empty">Listing not found.</div>;
  }

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/shopper/leftovers" className="app-back-link">← Leftovers</Link>
      <div className="app-row" style={{ marginBottom: '1rem' }}>
        <DiscoverThumb
          imageUrl={pickListingDisplayImage(listing.media_url)}
          category={listing.vendor?.category ?? 'Food & Drink'}
          size={64}
        />
        <div className="app-row-body">
          <h1 className="app-title" style={{ margin: 0 }}>{listing.title}</h1>
          <p className="app-row-meta">
            {listing.vendor?.business_name} · {formatPrice(listing.price_cents)}
          </p>
        </div>
      </div>

      <div className="app-card" style={{ marginTop: '1rem' }}>
        <p style={{ color: 'var(--color-warn)' }}>
          {formatExpiresIn(listing.hoursLeft)} · {listing.quantity_remaining} available
        </p>
        <p>Pickup: {listing.locationLabel}
          {listing.distanceMiles != null ? ` (${formatDistance(listing.distanceMiles)} away)` : ''}
        </p>
        {listing.description ? <p style={{ marginTop: '0.5rem' }}>{listing.description}</p> : null}
        {listing.pickup_notes ? <p className="app-row-meta">{listing.pickup_notes}</p> : null}
      </div>

      <div className="app-input-group">
        <label>Quantity</label>
        <div className="app-row" style={{ gap: '0.75rem' }}>
          <button type="button" className="app-btn app-btn--secondary" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
          <span>{quantity}</span>
          <button type="button" className="app-btn app-btn--secondary" onClick={() => setQuantity((q) => Math.min(listing.quantity_remaining, q + 1))}>+</button>
        </div>
      </div>

      <div className="app-input-group">
        <label>Notes (optional)</label>
        <textarea className="app-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={submitting} onClick={handleReserve}>
        {submitting ? 'Reserving…' : `Reserve · ${formatPrice(listing.price_cents * quantity)}`}
      </button>
    </div>
  );
}
