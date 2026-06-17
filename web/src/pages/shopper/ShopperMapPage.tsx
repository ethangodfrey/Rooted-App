import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { useMapFetchOrigin } from '@/hooks/use-map-fetch-origin';
import { useNow } from '@/hooks/use-now';
import { useUserCoords } from '@/hooks/use-user-coords';
import {
  capEventsNear,
  MAP_MARKER_LIMIT,
  MAP_SIDEBAR_LIMIT,
} from '@/lib/events-display-limits';
import { eventRuntimePhase, sortEventsByRuntime } from '@/lib/event-runtime';
import {
  centroidOfEvents,
  filterEventsForMapSearch,
  geocodeUsZip,
  parseMapSearchQuery,
} from '@/lib/event-map-search';
import { formatEventDate } from '@/lib/format';
import { distanceMiles, formatDistance, type Coords } from '@/lib/geo';
import { fetchPublicEvents } from '@/lib/events-query';
import type { Event } from '@/types/database';
import '@/components/ui/ui.css';
import '@/components/map/events-map.css';

const EventsMap = lazy(() =>
  import('@/components/map/EventsMap').then((module) => ({ default: module.EventsMap })),
);

const FOCUS_ZOOM = 11;
const LIST_NOW_MS = 60_000;

export function ShopperMapPage() {
  const navigate = useNavigate();
  const { coords } = useUserCoords();
  const fetchOrigin = useMapFetchOrigin(coords);
  const now = useNow(LIST_NOW_MS);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<Coords | null>(null);

  useEffect(() => {
    const parsed = parseMapSearchQuery(query);
    if (!parsed.zip) {
      setSearchCenter(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      const center = await geocodeUsZip(parsed.zip!);
      if (!cancelled) setSearchCenter(center);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    if (!query.trim()) return;
    const parsed = parseMapSearchQuery(query);
    if (parsed.zip && searchCenter) {
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
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await fetchPublicEvents({
        forMap: true,
        near: fetchOrigin,
      });

      if (!active) return;

      if (queryError) {
        setError(queryError);
        setEvents([]);
      } else {
        setEvents(data);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [fetchOrigin]);

  const filteredEvents = useMemo(
    () => filterEventsForMapSearch(events, query, searchCenter),
    [events, query, searchCenter],
  );

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

  const sidebarEvents = sortedEvents.slice(0, MAP_SIDEBAR_LIMIT);
  const hiddenSidebar = Math.max(0, sortedEvents.length - sidebarEvents.length);

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

  const openEventDetail = useCallback(
    (id: string) => {
      navigate(`/shopper/events/${id}`);
    },
    [navigate],
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
    <div className="app-screen app-screen--map">
      <p className="app-eyebrow">Explore</p>
      <h1 className="app-title">Map</h1>
      <p className="app-subtitle">
        Tap a pin to preview a market on the map, then open the full page when you&apos;re ready.
      </p>

      <input
        className="app-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by ZIP, city, or market name"
      />

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">Couldn&apos;t load events: {error}</div>
      ) : filteredEvents.length === 0 ? (
        <div className="app-empty">No mapped events match your search.</div>
      ) : (
        <div className="shopper-map-layout">
          <div>
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
                now={now}
                selectedEventId={selectedEventId}
                userCoords={coords}
                focusTarget={focusTarget}
                focusZoom={FOCUS_ZOOM}
                onPreviewEvent={previewEvent}
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

          <div className="shopper-map-list">
            <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
              {sortedEvents.length} event{sortedEvents.length === 1 ? '' : 's'}
              {hiddenSidebar > 0 ? ` · showing ${sidebarEvents.length} nearest` : ' on map'}
            </p>
            <div className="app-list">
              {sidebarEvents.map((event) => {
                const phase = eventRuntimePhase(event, now);
                return (
                <button
                  key={event.id}
                  type="button"
                  className={`app-card app-card--pressable app-row${selectedEventId === event.id ? ' app-card--honeydew' : ''}${phase === 'closed' ? ' app-card--closed' : ''}${phase === 'live' ? ' app-card--live' : ''}`}
                  onClick={() => openEventDetail(event.id)}
                >
                  <div className="app-row-icon">{phase === 'live' ? '●' : phase === 'closed' ? '◼' : '◷'}</div>
                  <div className="app-row-body" style={{ textAlign: 'left' }}>
                    <div style={{ marginBottom: '0.25rem' }}>
                      <EventStatusBadge event={event} showHint now={now} />
                    </div>
                    <p className="app-row-title">{event.name}</p>
                    <p className="app-row-meta">
                      {formatEventDate(event.start_datetime)}
                      {distanceFor(event) ? ` · ${distanceFor(event)}` : ''}
                    </p>
                  </div>
                  <Link
                    to={`/shopper/events/${event.id}`}
                    className="map-event-action"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View details for ${event.name}`}
                  >
                    Details →
                  </Link>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
