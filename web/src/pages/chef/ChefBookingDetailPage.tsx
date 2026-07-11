import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { CHEF_BOOKING_STATUS_LABEL } from '@/lib/chefs';
import { supabase } from '@/lib/supabase';
import type { ChefBooking } from '@/types/database';
import '@/components/ui/ui.css';

export function ChefBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { chef } = useAuth();
  const [booking, setBooking] = useState<ChefBooking | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [chefNotes, setChefNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!chef?.id) return;
    const { data } = await supabase
      .from('chef_bookings')
      .select('*')
      .eq('id', id)
      .eq('chef_id', chef.id)
      .maybeSingle();
    const row = data as ChefBooking | null;
    setBooking(row);
    if (row?.quoted_amount) setQuoteAmount(String(row.quoted_amount / 100));
    if (row?.chef_notes) setChefNotes(row.chef_notes);
    setLoading(false);
  }, [id, chef?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendQuote() {
    if (!booking || !chef?.id) return;
    const cents = Math.round(Number(quoteAmount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Enter a valid quote amount.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('chef_bookings')
      .update({
        quoted_amount: cents,
        chef_notes: chefNotes.trim() || null,
        booking_status: 'quoted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('chef_id', chef.id);

    setSaving(false);

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
      <Link to="/chef/bookings" className="app-back-link">
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
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Send quote</h2>
      <div className="app-input-group">
        <label htmlFor="quote">Quote amount (USD)</label>
        <input
          id="quote"
          type="number"
          min="0"
          step="0.01"
          className="app-input"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
          placeholder="450.00"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="notes">Notes for the customer (optional)</label>
        <textarea
          id="notes"
          className="app-textarea"
          value={chefNotes}
          onChange={(e) => setChefNotes(e.target.value)}
          placeholder="What's included, menu ideas, next steps…"
        />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button
        type="button"
        className="app-btn app-btn--primary"
        disabled={saving}
        onClick={sendQuote}
      >
        {saving ? 'Sending…' : 'Send quote to customer'}
      </button>
    </div>
  );
}
