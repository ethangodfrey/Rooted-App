import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { EventThumb } from '@/components/events/EventThumb';
import { useEventsScope } from '@/hooks/use-events-scope';
import { useNow } from '@/hooks/use-now';
import { useUserCoords } from '@/hooks/use-user-coords';
import { EVENTS_PAGE_SIZE } from '@/lib/events-display-limits';
import { eventsForScope } from '@/lib/events-list';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import { fetchPublicEvents } from '@/lib/events-query';
import { formatEventDate, formatEventTimeRange } from '@/lib/format';
import { distanceMiles, formatDistance } from '@/lib/geo';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

const LIST_NOW_MS = 60_000;

export function ShopperEventsPage() {
  const { coords } = useUserCoords();
  const { scope, setScope, ready } = useEventsScope();
  const now = useNow(LIST_NOW_MS);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EVENTS_PAGE_SIZE);

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: queryError, truncated: isTruncated } = await fetchPublicEvents({
      scope,
      near: coords,
    });

    if (queryError) {
      setError(queryError);
      setEvents([]);
    } else {
      setEvents(data);
    }
    setTruncated(isTruncated);
    setVisibleCount(EVENTS_PAGE_SIZE);
    setLoading(false);
  }, [scope, coords]);

  useEffect(() => {
    setLoading(true);
    void loadEvents();
  }, [loadEvents]);

  const displayedEvents = useMemo(
    () => sortEventsByRuntime(eventsForScope(events, scope, coords), now),
    [events, scope, coords, now],
  );

  const visibleEvents = displayedEvents.slice(0, visibleCount);
  const hasMore = visibleCount < displayedEvents.length;

  return (
    <div className="app-screen">
      <p className="app-eyebrow">{scope === 'local' ? 'Near you' : 'Across the US'}</p>
      <h1 className="app-title">Events</h1>

      {ready ? (
        <div style={{ marginBottom: '1rem' }}>
          <div className="app-scope-toggle">
            <button type="button" className={scope === 'local' ? 'active' : ''} onClick={() => setScope('local')}>
              Local events
            </button>
            <button type="button" className={scope === 'nationwide' ? 'active' : ''} onClick={() => setScope('nationwide')}>
              Nationwide
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : displayedEvents.length === 0 ? (
        <div className="app-empty">{error ? `Couldn't load events: ${error}` : 'No upcoming events yet.'}</div>
      ) : (
        <>
          {truncated && scope === 'nationwide' ? (
            <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
              Showing {events.length} markets nationwide. Use Local events or the map for more nearby.
            </p>
          ) : null}
          <div className="app-list">
            {visibleEvents.map((event) => {
              const phase = eventRuntimePhase(event, now);
              const dist =
                scope === 'local' && coords && event.latitude != null
                  ? formatDistance(distanceMiles(coords, { latitude: event.latitude, longitude: event.longitude }))
                  : null;
              return (
                <Link
                  key={event.id}
                  to={`/shopper/events/${event.id}`}
                  className={`app-card app-card--pressable app-row${phase === 'closed' ? ' app-card--closed' : ''}${phase === 'live' ? ' app-card--live' : ''}`}
                >
                  <EventThumb event={event} />
                  <div className="app-row-body">
                    <div style={{ marginBottom: '0.35rem' }}>
                      <EventStatusBadge event={event} now={now} />
                    </div>
                    <p className="app-row-title">{event.name}</p>
                    <p className="app-row-meta">
                      {formatEventDate(event.start_datetime)} · {formatEventTimeRange(event.start_datetime, event.end_datetime)}
                    </p>
                    <p className="app-row-meta">
                      {[event.city, event.state].filter(Boolean).join(', ')}
                      {dist ? ` · ${dist}` : ''}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          {hasMore ? (
            <button
              type="button"
              className="app-btn app-btn--secondary"
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={() => setVisibleCount((count) => count + EVENTS_PAGE_SIZE)}
            >
              Load more ({displayedEvents.length - visibleCount} remaining)
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
