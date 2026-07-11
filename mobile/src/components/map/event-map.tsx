import { useMemo } from 'react';
import MapView, { Marker } from 'react-native-maps';

import { useNow } from '@/src/hooks/use-now';
import { isValidCoords } from '@/src/lib/geo';
import {
  EVENT_RUNTIME_SYMBOL,
  eventRuntimePhase,
  type EventRuntimeFields,
} from '@/src/lib/event-runtime';
import { formatEventDisplayDate } from '@/src/lib/format';

import { EventMarker } from './event-marker';
import type { EventMapProps } from './types';

function markerLabel(
  event: EventRuntimeFields & { name: string; start_datetime: string },
  now: Date,
): string {
  const phase = eventRuntimePhase(event, now);
  const symbol = EVENT_RUNTIME_SYMBOL[phase];
  const short = event.name.length > 10 ? `${event.name.slice(0, 9)}…` : event.name;
  if (phase === 'live') return `${symbol} Now`;
  if (phase === 'closed') return `${symbol} Ended`;
  return short || formatEventDisplayDate(event, now);
}

export function EventMap({
  events,
  initialRegion,
  onPreviewEvent,
  mapRef,
  selectedEventId,
}: EventMapProps) {
  const now = useNow();
  const mappable = useMemo(
    () => events.filter((e) => isValidCoords(e)),
    [events],
  );

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
        const phase = eventRuntimePhase(event, now);
        return (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.latitude!, longitude: event.longitude! }}
            onPress={() => onPreviewEvent(event.id)}
            tracksViewChanges={false}
            title={event.name}
            description={formatEventDisplayDate(event, now)}>
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
