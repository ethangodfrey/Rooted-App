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
import { coordsFrom, distanceMiles, formatDistance, parseCoords, type Coords } from '@/lib/geo';
import {
  fetchActiveCommunityEventsWithParticipants,
  type CommunityEventWithParticipants,
} from '@/lib/community-events';
import { fetchPublicEvents } from '@/lib/events-query';
import { fetchSnapEligibleEventIds } from '@/lib/snap-ebt';
import {
  fetchTrackedBusinessesInBounds,
  type MapBounds,
  type TrackedBusiness,
} from '@/lib/spatial-businesses';
import {
  FARMER_SPECIALTIES,
  VENDOR_SPECIALTIES,
  type SpecialtyTag,
} from '@/lib/specialties';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';
import '@/components/map/events-map.css';
import { EventThumb } from '@/components/events/EventThumb';
import { MapListSkeleton } from '@/components/map/MapListSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

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
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyTag | null>(null);
  const [businesses, setBusinesses] = useState<TrackedBusiness[]>([]);
  const [mapZoom, setMapZoom] = useState(9);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const hasInitializedFocusRef = useRef(false);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBoundsRef = useRef<MapBounds | null>(null);
  const businessRequestIdRef = useRef(0);

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
      try {
        const [usda, community] = await Promise.all([
          fetchPublicEvents({
            forMap: true,
            near: eventFetchOrigin,
          }),
          fetchActiveCommunityEventsWithParticipants().catch(
            () => [] as CommunityEventWithParticipants[],
          ),
        ]);

        if (!active) return;

        if (usda.error) {
          setError(usda.error);
          setEvents([]);
        } else {
          setEvents(usda.data);
        }
        setCommunityEvents(community);
      } catch {
        if (!active) return;
        setError('Failed to load events');
        setEvents([]);
        setCommunityEvents([]);
      } finally {
        if (active) setLoading(false);
      }
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

  const loadBusinessesForBounds = useCallback(
    async (bounds: MapBounds) => {
      latestBoundsRef.current = bounds;
      const requestId = ++businessRequestIdRef.current;
      setBusinessError(null);
      try {
        const rows = await fetchTrackedBusinessesInBounds(
          bounds,
          specialtyFilter ? [specialtyFilter] : null,
        );
        if (requestId === businessRequestIdRef.current) {
          setBusinesses(rows);
        }
      } catch (err) {
        if (requestId === businessRequestIdRef.current) {
          setBusinesses([]);
          setBusinessError(err instanceof Error ? err.message : 'BOUNDS_QUERY_FAILED');
        }
      }
    },
    [specialtyFilter],
  );

  const onBoundsChange = useCallback(
    (bounds: MapBounds, zoom: number) => {
      setMapZoom(zoom);
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        void loadBusinessesForBounds(bounds);
      }, 280);
    },
    [loadBusinessesForBounds],
  );

  useEffect(() => {
    if (!latestBoundsRef.current) return;
    void loadBusinessesForBounds(latestBoundsRef.current);
  }, [loadBusinessesForBounds]);

  useEffect(() => {
    return () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    };
  }, []);

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
      const aCoords = parseCoords(a.latitude, a.longitude);
      const bCoords = parseCoords(b.latitude, b.longitude);
      if (!aCoords || !bCoords) return 0;
      return distanceMiles(sortOrigin, aCoords) - distanceMiles(sortOrigin, bCoords);
    });
  }, [filteredEvents, sortOrigin, now]);

  const listEvents = sortedEvents.slice(0, MAP_MARKER_LIMIT);

  const distanceFor = useCallback(
    (event: Event): string | null => {
      const origin = searchCenter ?? coords;
      const eventCoords = parseCoords(event.latitude, event.longitude);
      if (!origin || !eventCoords) return null;
      return formatDistance(distanceMiles(origin, eventCoords));
    },
    [coords, searchCenter],
  );

  const previewEvent = useCallback(
    (id: string) => {
      const event =
        mapEvents.find((item) => item.id === id) ??
        sortedEvents.find((item) => item.id === id);
      const eventCoords = event ? parseCoords(event.latitude, event.longitude) : null;
      if (!eventCoords) return;
      setSelectedEventId(id);
      setFocusTarget(eventCoords);
    },
    [mapEvents, sortedEvents],
  );

  const previewCommunityEvent = useCallback(
    (id: string) => {
      const event = communityEvents.find((item) => item.id === id);
      const eventCoords = event ? parseCoords(event.latitude, event.longitude) : null;
      if (!eventCoords) return;
      setSelectedEventId(id);
      setFocusTarget(eventCoords);
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
        const next = coordsFrom({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (!next) return;
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

      <div
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Map filters"
      >
        <button
          type="button"
          onClick={() => setSnapOnly((prev) => !prev)}
          aria-pressed={snapOnly}
          className={`inline-flex shrink-0 items-center rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide transition ${
            snapOnly
              ? 'border-emerald-500/70 bg-emerald-950 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
              : 'border-emerald-800 bg-emerald-950/50 text-emerald-300/90'
          }`}
        >
          ACCEPTS SNAP / EBT
        </button>
        <button
          type="button"
          onClick={() => setSpecialtyFilter(null)}
          aria-pressed={specialtyFilter === null}
          className={`inline-flex shrink-0 items-center border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide ${
            specialtyFilter === null
              ? 'border-zinc-700 bg-zinc-950 text-zinc-100'
              : 'border-zinc-800 bg-transparent text-zinc-500'
          }`}
        >
          ALL SPECIALTIES
        </button>
        {[...VENDOR_SPECIALTIES, ...FARMER_SPECIALTIES].slice(0, 6).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() =>
              setSpecialtyFilter((prev) => (prev === tag ? null : tag))
            }
            aria-pressed={specialtyFilter === tag}
            className={`inline-flex shrink-0 items-center border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide ${
              specialtyFilter === tag
                ? 'border-zinc-600 bg-zinc-950 text-zinc-100'
                : 'border-zinc-800 bg-transparent text-zinc-500'
            }`}
          >
            {tag.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {businessError ? (
        <p className="app-row-meta mt-2 font-mono uppercase tracking-wide text-red-400">
          BUSINESS BOUNDS · {businessError}
        </p>
      ) : businesses.length > 0 ? (
        <p className="app-row-meta mt-2 font-mono uppercase tracking-wide">
          VIEWPORT · {businesses.length} LOCAL PRODUCERS
        </p>
      ) : null}

      {loading ? (
        <MapListSkeleton />
      ) : error ? (
        <div className="app-empty">Couldn&apos;t load events: {error}</div>
      ) : (
        <div className="shopper-map-layout">
          <div className="relative z-0 min-w-0">
            {filteredEvents.length === 0 && communityForMap.length === 0 ? (
              <p className="app-empty" style={{ marginBottom: '0.75rem' }}>
                No mapped markets or community events match your search.
              </p>
            ) : null}

            <Suspense
              fallback={
                <div className="events-map-panel">
                  <Skeleton className="events-map-frame h-[50vh] min-h-[280px] w-full md:h-[60vh] md:min-h-[360px]" />
                </div>
              }
            >
              <EventsMap
                events={mapEvents}
                communityEvents={communityForMap}
                businesses={businesses}
                now={now}
                selectedEventId={selectedEventId}
                userCoords={coords}
                focusTarget={focusTarget ?? searchCenter}
                focusZoom={FOCUS_ZOOM}
                mapZoom={mapZoom}
                onBoundsChange={onBoundsChange}
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
                    <EventThumb event={event} size={48} />
                    <div className="app-hscroll-card__body min-w-0 flex-1">
                      {phase === 'live' ? (
                        <span className="app-hscroll-card__badge">Live</span>
                      ) : null}
                      <p className="app-hscroll-card__title truncate">{event.name}</p>
                      <p className="app-hscroll-card__meta truncate">
                        {formatEventDisplayDate(event, now)}
                        {distanceFor(event) ? ` · ${distanceFor(event)}` : ''}
                      </p>
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
