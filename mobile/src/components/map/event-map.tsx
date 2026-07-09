import { filterMappableEvents, parseCoords } from '@/src/lib/geo';
import { useMemo } from 'react';
import MapView, { Marker } from 'react-native-maps';

import { useNow } from '@/src/hooks/use-now';
import {
  EVENT_RUNTIME_SYMBOL,
  eventRuntimePhase,
  type EventRuntimeFields,
} from '@/src/lib/event-runtime';
import { formatEventDate } from '@/src/lib/format';

import { EventMarker } from './event-marker';
import type { EventMapProps } from './types';

function markerLabel(event: EventRuntimeFields & { name: string }, now: Date): string {
  const phase = eventRuntimePhase(event, now);
  const symbol = EVENT_RUNTIME_SYMBOL[phase];
  const short = event.name.length > 10 ? `${event.name.slice(0, 9)}…` : event.name;
  if (phase === 'live') return `${symbol} Now`;
  if (phase === 'closed') return `${symbol} Ended`;
  return short || formatEventDate(event.start_datetime);
}

export function EventMap({
  events,
  initialRegion,
  onPreviewEvent,
  mapRef,
  selectedEventId,
}: EventMapProps) {
  const now = useNow();
  const mappable = useMemo(() => filterMappableEvents(events), [events]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      showsUserLocation
      showsCompass={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}>
      {mappable.map((event) => {
        const coords = parseCoords(event.latitude, event.longitude);
        if (!coords) return null;

        const phase = eventRuntimePhase(event, now);
        return (
          <Marker
            key={event.id}
            coordinate={{ latitude: coords.latitude, longitude: coords.longitude }}
            onPress={() => onPreviewEvent(event.id)}
            tracksViewChanges={false}
            title={event.name}
            description={formatEventDate(event.start_datetime)}>
            <EventMarker
              label={markerLabel(event, now)}
              selected={selectedEventId === event.id}
              phase={phase}
            />
          </Marker>
        );
      })}
    </MapView>
  );
}
