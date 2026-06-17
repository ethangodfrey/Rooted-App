import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import { EventStatusBadge } from '@/components/events/EventStatusBadge';
import { useNow } from '@/hooks/use-now';
import { extractMarketLinks } from '@/lib/market-links';
import { eventRuntimePhase, type EventRuntimePhase } from '@/lib/event-runtime';
import { formatEventDate } from '@/lib/format';
import type { Coords } from '@/lib/geo';
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

function FitBounds({ events, active }: { events: Event[]; active: boolean }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!active || events.length === 0 || hasFittedRef.current) return;

    const bounds = L.latLngBounds(
      events.map((event) => [event.latitude, event.longitude] as [number, number]),
    );

    map.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
    hasFittedRef.current = true;
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
    if (!target) return;
    map.flyTo([target.latitude, target.longitude], zoom, { duration: 0.6 });
  }, [target, zoom, map]);

  return null;
}

interface EventsMapProps {
  events: Event[];
  selectedEventId: string | null;
  userCoords: Coords | null;
  focusTarget: Coords | null;
  focusZoom?: number;
  onPreviewEvent: (eventId: string) => void;
  onRecenter?: () => void;
  getDistanceLabel?: (event: Event) => string | null;
  now?: Date;
}

export function EventsMap({
  events,
  selectedEventId,
  userCoords,
  focusTarget,
  focusZoom = FOCUS_ZOOM,
  onPreviewEvent,
  onRecenter,
  getDistanceLabel,
  now: nowProp,
}: EventsMapProps) {
  const liveNow = useNow(60_000);
  const now = nowProp ?? liveNow;
  const initialCenter: [number, number] = userCoords
    ? [userCoords.latitude, userCoords.longitude]
    : [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];
  const initialZoom = userCoords ? 9 : DEFAULT_ZOOM;

  return (
    <div className="events-map-panel">
      <div className="events-map-frame">
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {events.length > 0 && !focusTarget ? (
            <FitBounds events={events} active={!focusTarget} />
          ) : null}
          {focusTarget ? <FlyToTarget target={focusTarget} zoom={focusZoom} /> : null}

          {userCoords ? (
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

          {events.map((event) => {
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
                    <div style={{ marginBottom: '0.35rem' }}>
                      <EventStatusBadge event={event} now={now} />
                    </div>
                    <strong>{event.name}</strong>
                    <p>
                      {formatEventDate(event.start_datetime)}
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
                      to={`/shopper/events/${event.id}`}
                      className="app-btn app-btn--primary app-btn--small"
                    >
                      View market page
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {onRecenter ? (
        <button
          type="button"
          className="events-map-recenter"
          onClick={onRecenter}
          aria-label="Center on my location"
          title="Center on my location"
        >
          ◎
        </button>
      ) : null}
    </div>
  );
}
