import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { formatEventDate, formatEventTimeRange } from '@/lib/format';
import { useNow } from '@/hooks/use-now';
import { sortEventsByRuntime } from '@/lib/event-runtime';
import { supabase } from '@/lib/supabase';
import type { Event, VisibilityStatus } from '@/types/database';
import '@/components/ui/ui.css';

type Filter = 'all' | VisibilityStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'draft', label: 'Draft' },
];

export function AdminEventsPage() {
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase.from('events').select('*').order('start_datetime', { ascending: true });
    if (filter !== 'all') {
      query = query.eq('visibility_status', filter);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      setEvents([]);
    } else {
      setEvents(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const sortedEvents = useMemo(() => sortEventsByRuntime(events, now), [events, now]);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Events</h1>

      <Link to="/admin/events/new" className="app-btn app-btn--primary" style={{ marginBottom: '1rem', display: 'inline-block' }}>
        Create event
      </Link>

      <div className="app-chip-row" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-chip${filter === item.key ? ' app-chip--selected' : ''}`}
            onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : sortedEvents.length === 0 ? (
        <div className="app-empty">No events.</div>
      ) : (
        <div className="app-list">
          {sortedEvents.map((event) => (
            <Link key={event.id} to={`/admin/events/${event.id}`} className="app-card app-card--pressable">
              <div style={{ marginBottom: '0.35rem' }}>
                <EventStatusBadge event={event} />
              </div>
              <p className="app-row-title">{event.name}</p>
              <p className="app-row-meta">
                {formatEventDate(event.start_datetime)} · {formatEventTimeRange(event.start_datetime, event.end_datetime)}
              </p>
              <p className="app-row-meta">{event.city}, {event.state} · {event.visibility_status}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
