import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { MarketGuideSections } from '@/components/events/MarketGuideSections';
import { MarketLinks } from '@/components/events/MarketLinks';
import { formatEventFullDate, formatEventTimeRange } from '@/lib/format';
import { extraInfoWithoutSocialLinks } from '@/lib/market-links';
import { EventThumb } from '@/components/events/EventThumb';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

function formatMarketType(value: string | null): string | null {
  if (!value) return null;
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ShopperEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [vendors, setVendors] = useState<{ id: string; business_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [eventRes, vendorEventsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).maybeSingle(),
        supabase.from('vendor_events').select('vendor:vendors(id, business_name)').eq('event_id', id).eq('participation_status', 'approved'),
      ]);
      setEvent(eventRes.data);
      const vendorList = ((vendorEventsRes.data ?? []) as unknown as { vendor: { id: string; business_name: string | null } | null }[])
        .map((row) => row.vendor)
        .filter(Boolean) as { id: string; business_name: string | null }[];
      setVendors(vendorList);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!event) return <div className="app-empty">Event not found.</div>;

  return (
    <div className="app-screen">
      <Link to="/shopper/events" className="app-back-link">← Events</Link>
      <EventThumb event={event} large />
      <div style={{ marginBottom: '0.75rem' }}>
        <EventStatusBadge event={event} showHint size="md" />
      </div>
      <h1 className="app-title">{event.name}</h1>
      <p className="app-subtitle">
        {formatEventFullDate(event.start_datetime, event.timezone)}
        <br />
        {formatEventTimeRange(event.start_datetime, event.end_datetime, event.timezone)}
      </p>

      {event.description ? (
        <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{event.description}</p>
      ) : null}

      {event.market_history ? (
        <div className="app-card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>History</h2>
          <p style={{ lineHeight: 1.6 }}>{event.market_history}</p>
        </div>
      ) : null}

      <MarketGuideSections event={event} />

      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        {formatMarketType(event.market_type) ? (
          <p className="app-row-meta" style={{ marginBottom: '0.5rem' }}>
            {formatMarketType(event.market_type)}
          </p>
        ) : null}
        {event.hours_summary ? (
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Schedule:</strong> {event.hours_summary}
          </p>
        ) : null}
        {event.address ? <p>{event.address}</p> : null}
        <p className="app-row-meta">
          {[event.city, event.state].filter(Boolean).join(', ')}
        </p>
        {event.admission_info ? (
          <p style={{ marginTop: '0.75rem' }}>
            <strong>Admission:</strong> {event.admission_info}
          </p>
        ) : null}
        {event.parking_info ? (
          <p style={{ marginTop: '0.5rem' }}>
            <strong>Parking:</strong> {event.parking_info}
          </p>
        ) : null}
        {extraInfoWithoutSocialLinks(event.extra_info) ? (
          <p style={{ marginTop: '0.5rem' }}>
            <strong>More info:</strong> {extraInfoWithoutSocialLinks(event.extra_info)}
          </p>
        ) : null}
        <MarketLinks event={event} />
      </div>

      {vendors.length > 0 ? (
        <>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Vendors on Rooted</h2>
          <div className="app-list">
            {vendors.map((vendor) => (
              <Link key={vendor.id} to={`/shopper/vendors/${vendor.id}`} className="app-card app-card--pressable">
                {vendor.business_name ?? 'Vendor'}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
