import { useMemo } from 'react';
import { View } from 'react-native';
import MapView, { Callout, CalloutSubview, Marker } from 'react-native-maps';

import { EventStatusBadge } from '@/src/components/events/event-status-badge';
import { MarketLinks } from '@/src/components/events/market-links';
import { Text } from '@/src/components/ui/text';
import { useNow } from '@/src/hooks/use-now';
import {
  EVENT_RUNTIME_SYMBOL,
  eventRuntimePhase,
  type EventRuntimeFields,
} from '@/src/lib/event-runtime';
import { formatEventDate } from '@/src/lib/format';
import { colors } from '@/src/theme/colors';
import { floatingShadow, radius } from '@/src/theme/layout';

import { EventMarker } from './event-marker';
import type { EventMapProps } from './types';

const calloutCardStyle = {
  width: 240,
  padding: 14,
  backgroundColor: colors.white,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  ...floatingShadow,
} as const;

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
  onOpenEvent,
  mapRef,
  selectedEventId,
  getDistanceLabel,
}: EventMapProps) {
  const now = useNow();
  const mappable = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events],
  );

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      showsUserLocation
      showsCompass={false}
      toolbarEnabled={false}>
      {mappable.map((event) => {
        const phase = eventRuntimePhase(event, now);
        const distance = getDistanceLabel?.(event);
        const location = [event.city, event.state].filter(Boolean).join(', ');
        return (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.latitude!, longitude: event.longitude! }}
            onPress={() => onPreviewEvent(event.id)}
            tracksViewChanges={false}>
            <EventMarker
              label={markerLabel(event, now)}
              selected={selectedEventId === event.id}
              phase={phase}
            />
            <Callout tooltip>
              <View style={calloutCardStyle}>
                <EventStatusBadge event={event} showHint now={now} />
                <Text variant="body" className="mb-1 mt-2 font-semibold text-ink" numberOfLines={2}>
                  {event.name}
                </Text>
                <Text variant="caption" className="text-muted" numberOfLines={3}>
                  {formatEventDate(event.start_datetime)}
                  {location ? ` · ${location}` : ''}
                  {distance ? ` · ${distance}` : ''}
                </Text>
                <MarketLinks event={event} />
                <CalloutSubview onPress={() => onOpenEvent(event.id)}>
                  <View
                    style={{
                      marginTop: 10,
                      backgroundColor: colors.primary,
                      borderRadius: radius.sm,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      alignItems: 'center',
                    }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                      View market page
                    </Text>
                  </View>
                </CalloutSubview>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}
