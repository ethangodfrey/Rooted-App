import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import { BusinessClusterModal } from '@/components/map/BusinessClusterModal';
import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { useNow } from '@/hooks/use-now';
import type { CommunityEventWithParticipants } from '@/lib/community-events';
import { centroidOfEvents } from '@/lib/event-map-search';
import { marketPath, vendorPath } from '@/lib/market-routes';
import { extractMarketLinks } from '@/lib/market-links';
import { eventRuntimePhase, type EventRuntimePhase } from '@/lib/event-runtime';
import { formatEventDisplayDate } from '@/lib/format';
import { isValidCoords, coordsFrom, type Coords } from '@/lib/geo';
import {
  clusterTrackedBusinesses,
  type MapBounds,
  type TrackedBusiness,
} from '@/lib/spatial-businesses';
import type { Event } from '@/types/database';

import './events-map.css';

const DEFAULT_CENTER: Coords = { latitude: 39.8283, longitude: -98.5795 };
const DEFAULT_ZOOM = 4;
const FOCUS_ZOOM = 11;

function markerIcon(selected: boolean, phase: EventRuntimePhase) {
  return L.divIcon({
    className: `rooted-map-marker rooted-map-marker--${phase}${selected ? ' rooted-map-marker--selected' : ''}`,
    html: '<div class="rooted-map-marker__dot"></div>',
    iconSize: selected ? [22, 22] : [18, 18],
    iconAnchor: selected ? [11, 11] : [9, 9],
  });
}

function communityMarkerIcon(selected: boolean) {
  return L.divIcon({
    className: `rooted-map-marker rooted-map-marker--community${selected ? ' rooted-map-marker--selected' : ''}`,
    html: '<div class="rooted-map-marker__dot"></div>',
    iconSize: selected ? [22, 22] : [18, 18],
    iconAnchor: selected ? [11, 11] : [9, 9],
  });
}

function businessMarkerIcon() {
  return L.divIcon({
    className: 'rooted-map-marker rooted-map-marker--business',
    html: '<div class="rooted-map-marker__dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function clusterMarkerIcon(count: number) {
  const label = String(count);
  return L.divIcon({
    className: 'rooted-map-marker rooted-map-marker--cluster',
    html: `<div class="rooted-map-marker__cluster">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function BoundsChangeReporter({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
}) {
  const map = useMap();
  const lastKeyRef = useRef<string>('');
  const callbackRef = useRef(onBoundsChange);
  callbackRef.current = onBoundsChange;

  const report = () => {
    const callback = callbackRef.current;
    if (!callback) return;
    const b = map.getBounds();
    const zoom = map.getZoom();
    const next: MapBounds = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    };
    const key = [
      next.minLat.toFixed(5),
      next.maxLat.toFixed(5),
      next.minLng.toFixed(5),
      next.maxLng.toFixed(5),
      zoom.toFixed(2),
    ].join(':');
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    callback(next, zoom);
  };

  useMapEvents({
    moveend: report,
    zoomend: report,
  });

  useEffect(() => {
    report();
  }, [map]);

  return null;
}

function FitBounds({ events, active }: { events: Event[]; active: boolean }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!active || events.length === 0 || hasFittedRef.current) return;

    const mappable = events.filter((event) => isValidCoords(event));
    if (mappable.length === 0) return;

    try {
      const bounds = L.latLngBounds(
        mappable.map((event) => [event.latitude, event.longitude] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
      hasFittedRef.current = true;
    } catch {
      // Skip corrupt or degenerate coordinate sets rather than crashing the map.
    }
  }, [events, map, active]);

  return null;
}

function FlyToTarget({
  target,
  zoom,
}: {
  target: Coords | null;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target || !isValidCoords(target)) return;
    try {
      map.flyTo([target.latitude, target.longitude], zoom, { duration: 0.6 });
    } catch {
      // Skip corrupt coordinates rather than crashing the map.
    }
  }, [target, zoom, map]);

  return null;
}

function InitialMapView({
  userCoords,
  events,
}: {
  userCoords: Coords | null;
  events: Event[];
}) {
  const map = useMap();
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (resolvedRef.current) return;

    function centerOnCoords(center: Coords, zoom: number) {
      try {
        map.setView([center.latitude, center.longitude], zoom);
        resolvedRef.current = true;
      } catch {
        // Skip corrupt coordinates rather than crashing the map.
      }
    }

    function fallbackToEvents() {
      if (resolvedRef.current) return;

      const mappable = events.filter((event) => isValidCoords(event));
      if (mappable.length === 0) return;

      try {
        if (mappable.length === 1) {
          centerOnCoords(
            { latitude: mappable[0].latitude, longitude: mappable[0].longitude },
            FOCUS_ZOOM,
          );
          return;
        }

        const bounds = L.latLngBounds(
          mappable.map((event) => [event.latitude, event.longitude] as [number, number]),
        );
        map.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
        resolvedRef.current = true;
      } catch {
        // Skip corrupt or degenerate coordinate sets rather than crashing the map.
      }
    }

    if (isValidCoords(userCoords)) {
      centerOnCoords(userCoords, 9);
      return;
    }

    if (!navigator.geolocation) {
      fallbackToEvents();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (resolvedRef.current) return;
        const gps = isValidCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
          ? {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }
          : null;
        if (!gps) {
          fallbackToEvents();
          return;
        }
        centerOnCoords(gps, 9);
      },
      () => {
        console.log('Location access denied, falling back to database bounds.');
        fallbackToEvents();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [userCoords, events, map]);

  return null;
}

interface EventsMapProps {
  events: Event[];
  /** Vendor/farmer hosted community events — orange pins. */
  communityEvents?: CommunityEventWithParticipants[];
  /** Approved vendors/farmers loaded for the current viewport. */
  businesses?: TrackedBusiness[];
  selectedEventId: string | null;
  userCoords: Coords | null;
  focusTarget: Coords | null;
  focusZoom?: number;
  mapZoom?: number;
  onPreviewEvent: (eventId: string) => void;
  onPreviewCommunityEvent?: (eventId: string) => void;
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
  onRecenter?: () => void;
  getDistanceLabel?: (event: Event) => string | null;
  now?: Date;
}

export function EventsMap({
  events,
  communityEvents = [],
  businesses = [],
  selectedEventId,
  userCoords,
  focusTarget,
  focusZoom = FOCUS_ZOOM,
  mapZoom = 9,
  onPreviewEvent,
  onPreviewCommunityEvent,
  onBoundsChange,
  onRecenter,
  getDistanceLabel,
  now: nowProp,
}: EventsMapProps) {
  const liveNow = useNow(60_000);
  const now = nowProp ?? liveNow;
  const [clusterModal, setClusterModal] = useState<TrackedBusiness[] | null>(null);
  const mappableEvents = useMemo(
    () => events.filter((event) => isValidCoords(event)),
    [events],
  );
  const mappableCommunity = useMemo(
    () =>
      communityEvents.filter((event) =>
        isValidCoords({ latitude: event.latitude, longitude: event.longitude }),
      ),
    [communityEvents],
  );
  const businessClusters = useMemo(
    () => clusterTrackedBusinesses(businesses, mapZoom),
    [businesses, mapZoom],
  );
  const eventCenter = centroidOfEvents(mappableEvents);
  const resolvedUserCoords = isValidCoords(userCoords) ? userCoords : null;
  const initialCenter: [number, number] = resolvedUserCoords
    ? [resolvedUserCoords.latitude, resolvedUserCoords.longitude]
    : eventCenter
      ? [eventCenter.latitude, eventCenter.longitude]
      : [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];
  const safeCenter = coordsFrom({
    latitude: initialCenter[0],
    longitude: initialCenter[1],
  }) ?? DEFAULT_CENTER;
  const initialZoom = resolvedUserCoords || eventCenter ? 9 : DEFAULT_ZOOM;

  return (
    <div className="events-map-panel relative isolate z-0">
      <div className="events-map-frame relative h-[50vh] min-h-[280px] w-full overflow-hidden rounded-2xl md:h-[60vh] md:min-h-[360px]">
        <MapContainer
          center={[safeCenter.latitude, safeCenter.longitude]}
          zoom={initialZoom}
          scrollWheelZoom
          className="h-full w-full rounded-2xl"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <InitialMapView userCoords={userCoords} events={mappableEvents} />
          <BoundsChangeReporter onBoundsChange={onBoundsChange} />

          {mappableEvents.length > 0 && !focusTarget && !onBoundsChange ? (
            <FitBounds events={mappableEvents} active={!focusTarget} />
          ) : null}
          {focusTarget && isValidCoords(focusTarget) ? (
            <FlyToTarget target={focusTarget} zoom={focusZoom} />
          ) : null}

          {userCoords && isValidCoords(userCoords) ? (
            <Marker
              position={[userCoords.latitude, userCoords.longitude]}
              icon={L.divIcon({
                className: 'rooted-map-marker',
                html: '<div class="rooted-map-marker__dot" style="background:#3b82f6;border-color:#fff"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7],
              })}
            >
              <Popup>You are here</Popup>
            </Marker>
          ) : null}

          {mappableEvents.map((event) => {
            const distance = getDistanceLabel?.(event);
            const phase = eventRuntimePhase(event, now);
            const links = extractMarketLinks(event);
            return (
              <Marker
                key={event.id}
                position={[event.latitude, event.longitude]}
                icon={markerIcon(event.id === selectedEventId, phase)}
                eventHandlers={{
                  click: () => onPreviewEvent(event.id),
                }}
              >
                <Popup>
                  <div className="events-map-popup">
                    <p className="events-map-popup__label">Market</p>
                    <div style={{ marginBottom: '0.35rem' }}>
                      <EventStatusBadge event={event} now={now} />
                    </div>
                    <strong>{event.name}</strong>
                    <p>
                      {formatEventDisplayDate(event, now)}
                      {[event.city, event.state].filter(Boolean).length
                        ? ` · ${[event.city, event.state].filter(Boolean).join(', ')}`
                        : ''}
                      {distance ? ` · ${distance}` : ''}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                      {links.website ? (
                        <a href={links.website} target="_blank" rel="noreferrer" className="app-btn app-btn--secondary app-btn--small">
                          Website
                        </a>
                      ) : null}
                      {links.facebook ? (
                        <a href={links.facebook} target="_blank" rel="noreferrer" className="app-btn app-btn--secondary app-btn--small">
                          Facebook
                        </a>
                      ) : null}
                      {links.instagram ? (
                        <a href={links.instagram} target="_blank" rel="noreferrer" className="app-btn app-btn--secondary app-btn--small">
                          Instagram
                        </a>
                      ) : null}
                    </div>
                    <Link
                      to={marketPath(event.id)}
                      className="app-btn app-btn--primary app-btn--small"
                    >
                      View market page
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {mappableCommunity.map((event) => (
            <Marker
              key={`community-${event.id}`}
              position={[event.latitude, event.longitude]}
              icon={communityMarkerIcon(event.id === selectedEventId)}
              eventHandlers={{
                click: () => onPreviewCommunityEvent?.(event.id),
              }}
            >
              <Popup>
                <div className="events-map-popup">
                  <p className="events-map-popup__label">Community event</p>
                  <span className="events-map-popup__sticker">
                    {event.event_type.replace(/_/g, ' ')}
                  </span>
                  <strong>{event.title}</strong>
                  <p>
                    {new Date(event.start_time).toLocaleString()} —{' '}
                    {new Date(event.end_time).toLocaleString()}
                  </p>
                  {event.description ? <p>{event.description}</p> : null}
                  <p className="events-map-popup__label" style={{ marginTop: '0.5rem' }}>
                    Participating businesses
                  </p>
                  {event.participants.length > 0 ? (
                    <ul className="events-map-popup__participants">
                      {event.participants.map((peer) => (
                        <li key={peer.profile_id}>
                          {peer.display_name}
                          {peer.role ? ` · ${peer.role.toUpperCase()}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No platform businesses listed yet.</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {businessClusters.map((cluster) => {
            if (cluster.count === 1) {
              const biz = cluster.businesses[0];
              return (
                <Marker
                  key={cluster.id}
                  position={[cluster.latitude, cluster.longitude]}
                  icon={businessMarkerIcon()}
                >
                  <Popup>
                    <div className="events-map-popup">
                      <p className="events-map-popup__label">
                        {(biz.entity_kind || 'BUSINESS').toUpperCase()}
                      </p>
                      <strong>{biz.display_name}</strong>
                      <p>
                        {[biz.sell_city, biz.sell_state].filter(Boolean).join(', ') ||
                          'LOCAL PRODUCER'}
                      </p>
                      {biz.entity_kind === 'vendor' ? (
                        <Link
                          to={vendorPath(biz.business_row_id)}
                          className="app-btn app-btn--primary app-btn--small"
                        >
                          View storefront
                        </Link>
                      ) : null}
                    </div>
                  </Popup>
                </Marker>
              );
            }

            return (
              <Marker
                key={cluster.id}
                position={[cluster.latitude, cluster.longitude]}
                icon={clusterMarkerIcon(cluster.count)}
                eventHandlers={{
                  click: () => setClusterModal(cluster.businesses),
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {onRecenter ? (
        <button
          type="button"
          className="events-map-recenter z-[1000]"
          onClick={onRecenter}
          aria-label="Center on my location"
          title="Center on my location"
        >
          ◎
        </button>
      ) : null}

      {clusterModal ? (
        <BusinessClusterModal
          businesses={clusterModal}
          onClose={() => setClusterModal(null)}
        />
      ) : null}
    </div>
  );
}
