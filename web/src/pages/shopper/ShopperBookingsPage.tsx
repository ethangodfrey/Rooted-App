import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { CHEF_BOOKING_STATUS_LABEL } from '@/lib/chefs';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ChefBooking } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<ChefBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('chef_bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    setBookings((data ?? []) as ChefBooking[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Vendorly</p>
      <h1 className="app-title">Chef bookings</h1>
      <p className="app-subtitle">Track your booking inquiries and respond to chef quotes.</p>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : bookings.length === 0 ? (
        <p className="app-empty">No booking inquiries yet.</p>
      ) : (
        <div className="app-list">
          {bookings.map((booking) => (
            <Link
              key={booking.id}
              to={`/shopper/bookings/${booking.id}`}
              className="app-card app-card--pressable app-row"
            >
              <div className="app-row-body">
                <p className="app-row-title">{booking.event_date}</p>
                <p className="app-row-meta">
                  {CHEF_BOOKING_STATUS_LABEL[booking.booking_status]}
                  {booking.quoted_amount ? ` · ${formatPrice(booking.quoted_amount)}` : ''}
                </p>
              </div>
              <span className="map-event-action">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
