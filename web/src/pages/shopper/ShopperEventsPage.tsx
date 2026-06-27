import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { EventThumb } from '@/components/events/EventThumb';
import { WeekStrip } from '@/components/events/WeekStrip';
import { useNow } from '@/hooks/use-now';
import { useUserCoords } from '@/hooks/use-user-coords';
import { EVENTS_PAGE_SIZE } from '@/lib/events-display-limits';
import { eventsForScope, type EventsScope } from '@/lib/events-list';
import {
  eventDatesForWeekStrip,
  filterEventsByCalendarDay,
  findNearestDayWithEvents,
  formatCalendarDayLabel,
  startOfDay,
} from '@/lib/event-day-filter';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import { fetchPublicEvents } from '@/lib/events-query';
import { formatEventDate, formatEventTimeRange } from '@/lib/format';
import { distanceMiles, formatDistance } from '@/lib/geo';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

const LIST_NOW_MS = 60_000;

export function ShopperEventsPage() {
  const { coords } = useUserCoords();
  const [scope, setScope] = useState<EventsScope>('local');
  const now = useNow(LIST_NOW_MS);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EVENTS_PAGE_SIZE);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: queryError, truncated: isTruncated } = await fetchPublicEvents({
      scope,
      near: scope === 'local' ? coords : null,
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

  useEffect(() => {
    setSelectedDate(startOfDay(now));
    setVisibleCount(EVENTS_PAGE_SIZE);
  }, [scope]);

  const scopedEvents = useMemo(
    () => eventsForScope(events, scope, coords),
    [events, scope, coords],
  );

  const displayedEvents = useMemo(
    () => sortEventsByRuntime(scopedEvents, now),
    [scopedEvents, now],
  );

  const dayFilteredEvents = useMemo(
    () => sortEventsByRuntime(filterEventsByCalendarDay(scopedEvents, selectedDate), now),
    [scopedEvents, selectedDate, now],
  );

  const stripEventDates = useMemo(
    () => eventDatesForWeekStrip(scopedEvents, now),
    [scopedEvents, now],
  );

  const nearestEventDay = useMemo(
    () => findNearestDayWithEvents(scopedEvents, selectedDate, now),
    [scopedEvents, selectedDate, now],
  );

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setVisibleCount(EVENTS_PAGE_SIZE);
  }, []);

  const visibleEvents = dayFilteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < dayFilteredEvents.length;

  return (
    <div className="app-screen app-screen--titled">
      <div className="app-section-header-inline" style={{ marginBottom: '0.5rem' }}>
        <p className="app-subtitle" style={{ margin: 0 }}>
          {scope === 'local'
            ? 'Upcoming farmers markets and pop-ups near you.'
            : 'Markets nationwide — sorted by date.'}
        </p>
        <button
          type="button"
          className="app-inline-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => setScope((current) => (current === 'local' ? 'nationwide' : 'local'))}
        >
          {scope === 'local' ? 'Show all markets' : 'Nearby only'}
        </button>
      </div>

      {!loading && displayedEvents.length > 0 ? (
        <WeekStrip
          eventDates={stripEventDates}
          now={now}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
      ) : null}

      {loading ? (
        <div className="app-list">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="app-skeleton app-skeleton--card" />
          ))}
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="app-empty">{error ? `Couldn't load events: ${error}` : 'No upcoming events yet.'}</div>
      ) : dayFilteredEvents.length === 0 ? (
        <div className="app-empty">
          <p style={{ margin: '0 0 0.5rem' }}>No markets on this day.</p>
          {nearestEventDay && nearestEventDay.getTime() !== selectedDate.getTime() ? (
            <p style={{ margin: 0 }}>
              <button
                type="button"
                className="app-inline-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => handleSelectDate(nearestEventDay)}
              >
                See markets on {formatCalendarDayLabel(nearestEventDay)}
              </button>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {truncated ? (
            <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
              {scope === 'nationwide'
                ? 'Showing the first 1,000 markets nationwide.'
                : 'Showing nearby markets only. Use the map to explore further out.'}
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
              Load more ({dayFilteredEvents.length - visibleCount} remaining)
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
