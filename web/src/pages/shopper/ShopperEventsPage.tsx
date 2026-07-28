import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { EventThumb } from '@/components/events/EventThumb';
import { WeekStrip } from '@/components/events/WeekStrip';
import { useMarketDetail } from '@/hooks/use-market-detail';
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
import { MarketHeroImage } from '@/components/market/MarketHeroImage';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import { fetchPublicEvents } from '@/lib/events-query';
import { formatEventDisplayDate, formatEventDisplayTimeRange } from '@/lib/format';
import { distanceMiles, formatDistance, parseCoords } from '@/lib/geo';
import { marketPath, vendorPath } from '@/lib/market-routes';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';

const LIST_NOW_MS = 60_000;

function hoursBadge(event: Event, now: Date): string {
  if (event.hours_summary?.trim()) return event.hours_summary.trim();
  const date = formatEventDisplayDate(event, now);
  const range = formatEventDisplayTimeRange(event);
  return `${date} · ${range}`;
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const eventsRequestRef = useRef(0);

  const loadEvents = useCallback(async () => {
    const requestId = ++eventsRequestRef.current;
    setError(null);
    try {
      const { data, error: queryError, truncated: isTruncated } = await fetchPublicEvents({
        scope,
        near: scope === 'local' ? coords : null,
      });
      if (requestId !== eventsRequestRef.current) return;

      if (queryError) {
        setError(queryError);
        setEvents([]);
      } else {
        setEvents(data);
      }
      setTruncated(isTruncated);
      setVisibleCount(EVENTS_PAGE_SIZE);
    } catch {
      if (requestId !== eventsRequestRef.current) return;
      setError('Failed to load events');
      setEvents([]);
    } finally {
      if (requestId === eventsRequestRef.current) setLoading(false);
    }
  }, [scope, coords]);

  useEffect(() => {
    setLoading(true);
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setSelectedDate(startOfDay(new Date()));
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

  useEffect(() => {
    if (visibleEvents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleEvents.some((event) => event.id === selectedId)) {
      setSelectedId(visibleEvents[0]!.id);
    }
  }, [visibleEvents, selectedId]);

  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => event.id === selectedId) ?? null,
    [visibleEvents, selectedId],
  );

  const preview = useMarketDetail(selectedEvent?.id);

  return (
    <div className="app-screen app-screen--titled" style={{ maxWidth: 1100 }}>
      <p className="app-eyebrow">Boutique directory</p>
      <h1 className="app-title" style={{ marginBottom: '0.35rem' }}>
        Markets
      </h1>
      <div className="app-section-header-inline" style={{ marginBottom: '1rem' }}>
        <p className="app-subtitle" style={{ margin: 0 }}>
          {scope === 'local'
            ? 'Curated markets near you — select a card to preview.'
            : 'Nationwide directory — sorted by date.'}
        </p>
        <button
          type="button"
          className="app-inline-link"
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
            <div key={i} className="app-skeleton app-skeleton--card animate-pulse" />
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

          <div className="markets-split">
            <div className="markets-split__list">
              <div className="app-list">
                {visibleEvents.map((event) => {
                  const phase = eventRuntimePhase(event, now);
                  const eventCoords = parseCoords(event.latitude, event.longitude);
                  const miles =
                    scope === 'local' && coords && eventCoords
                      ? distanceMiles(coords, eventCoords)
                      : null;
                  const dist = miles != null ? formatDistance(miles) : null;
                  const active = event.id === selectedId;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={`markets-split__item${active ? ' markets-split__item--active' : ''}${
                        phase === 'closed' ? ' app-card--closed' : ''
                      }${phase === 'live' ? ' app-card--live' : ''}`}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <EventThumb event={event} size={52} />
                      <div className="app-row-body">
                        <div style={{ marginBottom: '0.25rem' }}>
                          <EventStatusBadge event={event} now={now} />
                        </div>
                        <p className="app-row-title" style={{ fontSize: '0.9375rem' }}>
                          {event.name}
                        </p>
                        <span className="markets-split__hours">{hoursBadge(event, now)}</span>
                        {dist ? (
                          <span className="markets-split__distance">{dist} away</span>
                        ) : (
                          <span className="markets-split__distance">
                            {[event.city, event.state].filter(Boolean).join(', ') || 'Location TBD'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {hasMore ? (
                <button
                  type="button"
                  className="app-btn app-btn--secondary"
                  style={{ margin: '0.75rem', width: 'calc(100% - 1.5rem)' }}
                  onClick={() => setVisibleCount((count) => count + EVENTS_PAGE_SIZE)}
                >
                  Load more ({dayFilteredEvents.length - visibleCount} remaining)
                </button>
              ) : null}
            </div>

            <div className="markets-split__preview">
              {selectedEvent ? (
                <article className="markets-preview">
                  <div className="markets-preview__hero">
                    {selectedEvent ? (
                      <MarketHeroImage
                        event={selectedEvent}
                        className="!h-full !min-h-[220px] !rounded-none shadow-none"
                      />
                    ) : (
                      <div className="markets-preview__hero-fallback">Market preview</div>
                    )}
                  </div>
                  <div className="markets-preview__body">
                    <p className="ft-label" style={{ marginBottom: 0 }}>
                      Selected market
                    </p>
                    <h2 className="markets-preview__title">{selectedEvent.name}</h2>
                    <p className="markets-preview__meta">
                      {hoursBadge(selectedEvent, now)}
                      {[selectedEvent.city, selectedEvent.state].filter(Boolean).length
                        ? ` · ${[selectedEvent.city, selectedEvent.state].filter(Boolean).join(', ')}`
                        : ''}
                      {preview.distanceLabel ? ` · ${preview.distanceLabel} away` : ''}
                    </p>
                    {selectedEvent.description ? (
                      <p className="markets-preview__meta" style={{ marginTop: '0.85rem', maxWidth: '36rem' }}>
                        {selectedEvent.description}
                      </p>
                    ) : null}

                    <div className="markets-preview__vendors">
                      <p className="ft-label">Local vendor roster</p>
                      {preview.loading ? (
                        <div aria-busy aria-label="Loading vendors">
                          {Array.from({ length: 3 }, (_, index) => (
                            <div key={index} className="markets-preview__vendor-skeleton">
                              <Skeleton style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
                              <div className="min-w-0 flex-1">
                                <SkeletonText width="60%" height={14} />
                                <SkeletonText width="40%" height={12} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : preview.vendors.length === 0 ? (
                        <p className="ft-subhead">No approved vendors listed for this market yet.</p>
                      ) : (
                        preview.vendors.slice(0, 8).map((vendor) => (
                          <Link
                            key={vendor.id}
                            to={vendorPath(vendor.id, selectedEvent.id)}
                            className="markets-preview__vendor-row markets-preview__vendor-row--link"
                          >
                            <div>
                              <p className="app-row-title" style={{ fontSize: '0.875rem' }}>
                                {vendor.business_name ?? 'Vendor'}
                              </p>
                              <p className="ft-subhead">
                                {vendor.category ?? vendor.product_summary ?? 'Local maker'}
                              </p>
                            </div>
                            <span className="markets-split__distance">View profile</span>
                          </Link>
                        ))
                      )}
                    </div>

                    <Link
                      to={marketPath(selectedEvent.id)}
                      className="app-btn app-btn--primary"
                      style={{ marginTop: '1.25rem', maxWidth: 280 }}
                    >
                      Open market detail
                    </Link>
                  </div>
                </article>
              ) : (
                <div className="app-empty">Select a market to preview.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
