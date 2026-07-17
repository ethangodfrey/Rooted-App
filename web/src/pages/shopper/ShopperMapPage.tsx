import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMapFetchOrigin } from '@/hooks/use-map-fetch-origin';
import { useNow } from '@/hooks/use-now';
import { useUserCoords } from '@/hooks/use-user-coords';
import {
  capEventsNear,
  MAP_MARKER_LIMIT,
} from '@/lib/events-display-limits';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import {
  centroidOfEvents,
  filterEventsForMapSearch,
  geocodePlaceQuery,
  geocodeUsZip,
  parseMapSearchQuery,
} from '@/lib/event-map-search';
import { formatEventDisplayDate } from '@/lib/format';
import { distanceMiles, formatDistance, type Coords } from '@/lib/geo';
import {
  fetchActiveCommunityEventsWithParticipants,
  type CommunityEventWithParticipants,
} from '@/lib/community-events';
import { fetchPublicEvents } from '@/lib/events-query';
import { fetchSnapEligibleEventIds } from '@/lib/snap-ebt';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';
import '@/components/map/events-map.css';

const EventsMap = lazy(() =>
  import('@/components/map/EventsMap').then((module) => ({ default: module.EventsMap })),
);

const FOCUS_ZOOM = 11;
const LIST_NOW_MS = 60_000;

export function ShopperMapPage() {
  const { coords } = useUserCoords();
  const fetchOrigin = useMapFetchOrigin(coords);
  const now = useNow(LIST_NOW_MS);
  const [events, setEvents] = useState<Event[]>([]);
  const [communityEvents, setCommunityEvents] = useState<CommunityEventWithParticipants[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<Coords | null>(null);
  const [snapOnly, setSnapOnly] = useState(false);
  const [snapEventIds, setSnapEventIds] = useState<Set<string> | null>(null);
  const hasInitializedFocusRef = useRef(false);

  const eventFetchOrigin = searchCenter ?? fetchOrigin ?? coords;

  useEffect(() => {
    const parsed = parseMapSearchQuery(query);
    if (!parsed.trimmed) {
      setSearchCenter(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      if (parsed.zip) {
        const center = await geocodeUsZip(parsed.zip);
        if (!cancelled) setSearchCenter(center);
        return;
      }

      if (parsed.textTerms.length > 0) {
        const center = await geocodePlaceQuery(parsed.textTerms.join(' '));
        if (!cancelled) setSearchCenter(center);
        return;
      }

      if (!cancelled) setSearchCenter(null);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    if (!query.trim()) return;
    const parsed = parseMapSearchQuery(query);
    if ((parsed.zip || parsed.textTerms.length > 0) && searchCenter) {
      setFocusTarget(searchCenter);
      setSelectedEventId(null);
      return;
    }

    const filtered = filterEventsForMapSearch(events, query, searchCenter);
    const center = centroidOfEvents(filtered);
    if (center) {
      setFocusTarget(center);
      setSelectedEventId(null);
    }
  }, [query, searchCenter, events]);

  useEffect(() => {
    if (hasInitializedFocusRef.current || query.trim()) return;
    if (coords) {
      setFocusTarget(coords);
      hasInitializedFocusRef.current = true;
      return;
    }
    if (!loading && events.length > 0) {
      const center = centroidOfEvents(events);
      if (center) {
        setFocusTarget(center);
        hasInitializedFocusRef.current = true;
      }
    }
  }, [coords, events, loading, query]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const [usda, community] = await Promise.all([
        fetchPublicEvents({
          forMap: true,
          near: eventFetchOrigin,
        }),
        fetchActiveCommunityEventsWithParticipants().catch(() => [] as CommunityEventWithParticipants[]),
      ]);

      if (!active) return;

      if (usda.error) {
        setError(usda.error);
        setEvents([]);
      } else {
        setEvents(usda.data);
      }
      setCommunityEvents(community);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [eventFetchOrigin]);

  useEffect(() => {
    if (events.length === 0) {
      setSnapEventIds(new Set());
      return;
    }
    let active = true;
    void fetchSnapEligibleEventIds(events.map((event) => event.id))
      .then((ids) => {
        if (active) setSnapEventIds(ids);
      })
      .catch(() => {
        if (active) setSnapEventIds(new Set());
      });
    return () => {
      active = false;
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const searched = filterEventsForMapSearch(events, query, searchCenter);
    if (!snapOnly || !snapEventIds) return searched;
    return searched.filter((event) => snapEventIds.has(event.id));
  }, [events, query, searchCenter, snapOnly, snapEventIds]);

  const sortOrigin = searchCenter ?? fetchOrigin ?? coords;

  const { items: mapEvents, hidden: hiddenMapMarkers } = useMemo(
    () => capEventsNear(filteredEvents, sortOrigin, MAP_MARKER_LIMIT),
    [filteredEvents, sortOrigin],
  );

  const sortedEvents = useMemo(() => {
    const runtimeSorted = sortEventsByRuntime(filteredEvents, now);
    if (!sortOrigin) return runtimeSorted;

    const phaseRank = (event: Event) => {
      const phase = eventRuntimePhase(event, now);
      return phase === 'live' ? 0 : phase === 'upcoming' ? 1 : phase === 'closed' ? 2 : 3;
    };

    return [...runtimeSorted].sort((a, b) => {
      const phaseDiff = phaseRank(a) - phaseRank(b);
      if (phaseDiff !== 0) return phaseDiff;
      return (
        distanceMiles(sortOrigin, { latitude: a.latitude, longitude: a.longitude }) -
        distanceMiles(sortOrigin, { latitude: b.latitude, longitude: b.longitude })
      );
    });
  }, [filteredEvents, sortOrigin, now]);

  const listEvents = sortedEvents.slice(0, MAP_MARKER_LIMIT);

  const distanceFor = useCallback(
    (event: Event): string | null => {
      const origin = searchCenter ?? coords;
      if (!origin) return null;
      return formatDistance(
        distanceMiles(origin, { latitude: event.latitude, longitude: event.longitude }),
      );
    },
    [coords, searchCenter],
  );

  const previewEvent = useCallback(
    (id: string) => {
      const event =
        mapEvents.find((item) => item.id === id) ??
        sortedEvents.find((item) => item.id === id);
      if (!event) return;
      setSelectedEventId(id);
      setFocusTarget({ latitude: event.latitude, longitude: event.longitude });
    },
    [mapEvents, sortedEvents],
  );

  const previewCommunityEvent = useCallback(
    (id: string) => {
      const event = communityEvents.find((item) => item.id === id);
      if (!event) return;
      setSelectedEventId(id);
      setFocusTarget({ latitude: event.latitude, longitude: event.longitude });
    },
    [communityEvents],
  );

  const communityForMap = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communityEvents;
    return communityEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(q) ||
        event.event_type.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q),
    );
  }, [communityEvents, query]);

  function recenterOnUser() {
    if (!coords) return;
    setSelectedEventId(null);
    setFocusTarget(coords);
  }

  function requestUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setFocusTarget(next);
        setSelectedEventId(null);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    );
  }

  return (
    <div className="app-screen app-screen--map app-screen--titled">
      <p className="app-subtitle">
        Explore markets on the map — or open the{' '}
        <Link to="/explore/feed" className="font-semibold text-orange-400 underline-offset-2 hover:underline">
          swipe feed
        </Link>{' '}
        for personalized listings.
      </p>

      <input
        className="app-search app-search--glass"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by ZIP, city, or market name"
      />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Map filters">
        <button
          type="button"
          onClick={() => setSnapOnly((prev) => !prev)}
          aria-pressed={snapOnly}
          className={`inline-flex items-center rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide transition ${
            snapOnly
              ? 'border-emerald-500/70 bg-emerald-950 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
              : 'border-emerald-800 bg-emerald-950/50 text-emerald-300/90'
          }`}
        >
          ACCEPTS SNAP / EBT
        </button>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">Couldn&apos;t load events: {error}</div>
      ) : (
        <div className="shopper-map-layout">
          <div className="relative z-0 min-w-0">
            {filteredEvents.length === 0 ? (
              <p className="app-empty" style={{ marginBottom: '0.75rem' }}>
                No mapped events match your search.
              </p>
            ) : null}

            <Suspense
              fallback={
                <div className="events-map-panel">
                  <div className="events-map-frame app-loading">
                    <div className="app-spinner" />
                  </div>
                </div>
              }
            >
              <EventsMap
                events={mapEvents}
                communityEvents={communityForMap}
                now={now}
                selectedEventId={selectedEventId}
                userCoords={coords}
                focusTarget={focusTarget ?? searchCenter}
                focusZoom={FOCUS_ZOOM}
                onPreviewEvent={previewEvent}
                onPreviewCommunityEvent={previewCommunityEvent}
                onRecenter={() => (coords ? recenterOnUser() : requestUserLocation())}
                getDistanceLabel={distanceFor}
              />
            </Suspense>

            {hiddenMapMarkers > 0 ? (
              <p className="app-row-meta" style={{ marginTop: '0.5rem' }}>
                Showing {mapEvents.length} nearest pins ({hiddenMapMarkers} more in this area — refine your search).
              </p>
            ) : null}
          </div>

          {listEvents.length > 0 ? (
            <div className="shopper-map-list flex w-full flex-col space-y-4 px-4 pb-32 md:max-h-[min(68vh,520px)] md:overflow-y-auto md:px-0 md:pb-0">
              {listEvents.map((event) => {
                const phase = eventRuntimePhase(event, now);
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`app-hscroll-card shopper-map-carousel-card${selectedEventId === event.id ? ' is-selected' : ''}${phase === 'closed' ? ' app-card--closed' : ''}`}
                    onClick={() => previewEvent(event.id)}
                  >
                    <div className="app-hscroll-card__body">
                      <p className="app-hscroll-card__title">{event.name}</p>
                      <p className="app-hscroll-card__meta">
                        {formatEventDisplayDate(event, now)}
                        {distanceFor(event) ? ` · ${distanceFor(event)}` : ''}
                      </p>
                      {phase === 'live' ? (
                        <span className="app-hscroll-card__badge">Live</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
