import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { useAuth } from '@/hooks/use-auth';
import { useNow } from '@/hooks/use-now';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import { formatEventDate, formatEventTimeRange } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

export function VendorEventsPage() {
  const { vendor } = useAuth();
  const now = useNow();
  const [events, setEvents] = useState<Event[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    setError(null);

    const [eventsRes, participationRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('visibility_status', 'public')
        .order('start_datetime', { ascending: true }),
      supabase.from('vendor_events').select('event_id').eq('vendor_id', vendor.id),
    ]);

    if (eventsRes.error) {
      setError(eventsRes.error.message);
    } else {
      setEvents(eventsRes.data ?? []);
    }
    if (!participationRes.error && participationRes.data) {
      setJoined(new Set(participationRes.data.map((row) => row.event_id as string)));
    }
  }, [vendor]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function toggle(eventId: string) {
    if (!vendor) return;
    setBusyId(eventId);
    setError(null);

    const isJoined = joined.has(eventId);
    if (isJoined) {
      const { error: delError } = await supabase
        .from('vendor_events')
        .delete()
        .eq('vendor_id', vendor.id)
        .eq('event_id', eventId);
      if (delError) {
        setError(delError.message);
      } else {
        setJoined((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    } else {
      const { error: insError } = await supabase.from('vendor_events').upsert(
        {
          vendor_id: vendor.id,
          event_id: eventId,
          participation_status: 'approved',
        },
        { onConflict: 'vendor_id,event_id' },
      );
      if (insError) {
        setError(insError.message);
      } else {
        setJoined((prev) => new Set(prev).add(eventId));
      }
    }

    setBusyId(null);
  }

  const sortedEvents = useMemo(() => sortEventsByRuntime(events, now), [events, now]);

  return (
    <div className="app-screen">
      <Link to="/vendor/dashboard" className="app-back-link">← Dashboard</Link>
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">My events</h1>
      <p className="app-subtitle">Join markets to list products and accept reservations.</p>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : sortedEvents.length === 0 ? (
        <div className="app-empty">No public events available yet.</div>
      ) : (
        <div className="app-list">
          {sortedEvents.map((event) => {
            const isJoined = joined.has(event.id);
            const phase = eventRuntimePhase(event, now);
            return (
              <div
                key={event.id}
                className={`app-card${phase === 'closed' ? ' app-card--closed' : ''}${phase === 'live' ? ' app-card--live' : ''}`}
              >
                <div style={{ marginBottom: '0.35rem' }}>
                  <EventStatusBadge event={event} />
                </div>
                <p className="app-row-title">{event.name}</p>
                <p className="app-row-meta">
                  {formatEventDate(event.start_datetime)} · {formatEventTimeRange(event.start_datetime, event.end_datetime)}
                </p>
                {event.city ? <p className="app-row-meta">{event.city}, {event.state}</p> : null}
                <button
                  type="button"
                  className={`app-btn app-btn--small${isJoined ? ' app-btn--secondary' : ' app-btn--primary'}`}
                  style={{ marginTop: '0.75rem' }}
                  disabled={busyId === event.id}
                  onClick={() => void toggle(event.id)}>
                  {busyId === event.id ? 'Saving…' : isJoined ? 'Leave event' : 'Join event'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
