import { useMemo, useState } from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';
import { View } from 'react-native';

import { BusinessClusterSheet } from '@/src/components/map/business-cluster-sheet';
import { useNow } from '@/src/hooks/use-now';
import { isValidCoords } from '@/src/lib/geo';
import {
  EVENT_RUNTIME_SYMBOL,
  eventRuntimePhase,
  type EventRuntimeFields,
} from '@/src/lib/event-runtime';
import { formatEventDisplayDate } from '@/src/lib/format';
import {
  clusterTrackedBusinesses,
  zoomFromLatitudeDelta,
  type TrackedBusiness,
} from '@/src/lib/spatial-businesses';
import { colors } from '@/src/theme/colors';
import { Text } from '@/src/components/ui/text';

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
  businesses = [],
  initialRegion,
  onPreviewEvent,
  onRegionChangeComplete,
  mapRef,
  selectedEventId,
}: EventMapProps) {
  const now = useNow();
  const [clusterModal, setClusterModal] = useState<TrackedBusiness[] | null>(null);
  const [region, setRegion] = useState(initialRegion);

  const mappable = useMemo(
    () => events.filter((e) => isValidCoords(e)),
    [events],
  );

  const clusters = useMemo(
    () =>
      clusterTrackedBusinesses(
        businesses,
        zoomFromLatitudeDelta(region.latitudeDelta),
      ),
    [businesses, region.latitudeDelta],
  );

  return (
    <>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation
        showsCompass={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        onRegionChangeComplete={(next: Region) => {
          setRegion(next);
          onRegionChangeComplete?.(next);
        }}>
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

        {clusters.map((cluster) => {
          if (cluster.count === 1) {
            const biz = cluster.businesses[0]!;
            return (
              <Marker
                key={cluster.id}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                tracksViewChanges={false}
                title={biz.display_name}
                description={(biz.entity_kind || 'BUSINESS').toUpperCase()}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#18181b',
                    borderWidth: 2,
                    borderColor: '#fafafa',
                  }}
                />
              </Marker>
            );
          }

          return (
            <Marker
              key={cluster.id}
              coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
              tracksViewChanges={false}
              onPress={() => setClusterModal(cluster.businesses)}>
              <View
                style={{
                  minWidth: 34,
                  height: 34,
                  paddingHorizontal: 8,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: '#fafafa',
                  backgroundColor: '#09090b',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                  }}>
                  {cluster.count}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <BusinessClusterSheet
        businesses={clusterModal}
        onClose={() => setClusterModal(null)}
      />
    </>
  );
}
