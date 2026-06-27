import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { CHEF_BOOKING_STATUS_LABEL } from '@/lib/chefs';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ChefBooking } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<ChefBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBooking(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('chef_bookings')
      .select('*')
      .eq('id', id)
      .eq('customer_id', user.id)
      .maybeSingle();
    setBooking(data as ChefBooking | null);
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respondToQuote(nextStatus: 'confirmed' | 'declined') {
    if (!booking || !user?.id) return;
    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('chef_bookings')
      .update({ booking_status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('customer_id', user.id)
      .eq('booking_status', 'quoted');

    setActing(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  if (loading)
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  if (!booking) return <div className="app-empty">Booking not found.</div>;

  return (
    <div className="app-screen">
      <Link to="/shopper/bookings" className="app-back-link">
        ← Back
      </Link>

      <h1 className="app-title">{booking.event_date}</h1>
      <p className="app-subtitle">
        <span className="app-status">{CHEF_BOOKING_STATUS_LABEL[booking.booking_status]}</span>
      </p>

      <div className="app-card" style={{ marginBottom: '1rem' }}>
        {booking.guest_count ? (
          <p className="app-row-meta">Guests: {booking.guest_count}</p>
        ) : null}
        {booking.location_address ? (
          <p className="app-row-meta">Location: {booking.location_address}</p>
        ) : null}
        {booking.special_requests ? (
          <p className="app-row-meta">Requests: {booking.special_requests}</p>
        ) : null}
        {booking.chef_notes ? (
          <p className="app-row-meta" style={{ fontStyle: 'italic' }}>
            Chef notes: {booking.chef_notes}
          </p>
        ) : null}
      </div>

      {booking.booking_status === 'quoted' && booking.quoted_amount ? (
        <div className="app-card app-card--honeydew">
          <p className="app-eyebrow">Quote received</p>
          <p className="app-title" style={{ margin: '0 0 1rem' }}>
            {formatPrice(booking.quoted_amount)}
          </p>
          {error ? <p className="app-error">{error}</p> : null}
          <button
            type="button"
            className="app-btn app-btn--primary"
            disabled={acting}
            onClick={() => respondToQuote('confirmed')}
          >
            {acting ? 'Working…' : 'Accept quote'}
          </button>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            style={{ marginTop: '0.5rem', width: '100%' }}
            disabled={acting}
            onClick={() => respondToQuote('declined')}
          >
            Decline quote
          </button>
        </div>
      ) : null}

      {error && booking.booking_status !== 'quoted' ? <p className="app-error">{error}</p> : null}
    </div>
  );
}
