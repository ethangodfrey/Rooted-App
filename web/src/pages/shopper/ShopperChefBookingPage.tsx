import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { useAuth } from '@/hooks/use-auth';
import { CHEF_SERVICE_TYPE_LABEL, formatServicePrice } from '@/lib/chefs';
import { supabase } from '@/lib/supabase';
import type { ChefService } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperChefBookingPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState<ChefService | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [location, setLocation] = useState('');
  const [requests, setRequests] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('chef_services')
        .select('*')
        .eq('id', serviceId)
        .maybeSingle();
      setService(data as ChefService | null);
      setLoading(false);
    }
    void load();
  }, [serviceId]);

  async function handleSubmit() {
    if (!user?.id || !service) return;
    if (!eventDate.trim()) {
      setError('Enter an event date.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('chef_bookings').insert({
      customer_id: user.id,
      chef_id: service.chef_id,
      service_id: service.id,
      event_date: eventDate.trim(),
      guest_count: guestCount ? Number(guestCount) : null,
      location_address: location.trim() || null,
      special_requests: requests.trim() || null,
      booking_status: 'inquiry',
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate(`/shopper/chefs/${service.chef_id}`);
  }

  if (loading)
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  if (!service) return <div className="app-empty">Service not found.</div>;

  return (
    <div className="app-screen app-screen--narrow">
      <button type="button" className="app-back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <p className="app-eyebrow">Booking inquiry</p>
      <h1 className="app-title">Request booking</h1>
      <p className="app-subtitle">
        {service.service_name} · {CHEF_SERVICE_TYPE_LABEL[service.service_type]} ·{' '}
        {formatServicePrice(service.base_price, service.price_type)}. The chef will respond with a
        quote.
      </p>

      <div className="app-input-group">
        <label htmlFor="event-date">Event date</label>
        <input
          id="event-date"
          type="date"
          className="app-input"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="guests">Guest count</label>
        <input
          id="guests"
          type="number"
          min="1"
          className="app-input"
          value={guestCount}
          onChange={(e) => setGuestCount(e.target.value)}
          placeholder="8"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="location">Location / address</label>
        <input
          id="location"
          className="app-input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where will the event take place?"
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="requests">Dietary needs & special requests</label>
        <textarea
          id="requests"
          className="app-textarea"
          value={requests}
          onChange={(e) => setRequests(e.target.value)}
          placeholder="Allergies, theme, preferences…"
        />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button
        type="button"
        className="app-btn app-btn--primary"
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Submitting…' : 'Submit inquiry'}
      </button>

      <ReviewsSection targetType="service" targetId={service.id} />
    </div>
  );
}
