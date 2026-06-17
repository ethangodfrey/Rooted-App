import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventMap } from '@/src/components/map/event-map';
import { MapBottomSheet } from '@/src/components/map/map-bottom-sheet';
import { MapFloatingControl } from '@/src/components/map/map-floating-control';
import { MapFloatingSearch } from '@/src/components/map/map-floating-search';
import type { MapRegion } from '@/src/components/map/types';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Text } from '@/src/components/ui/text';
import { useMapFetchOrigin } from '@/src/hooks/use-map-fetch-origin';
import { useNow } from '@/src/hooks/use-now';
import { requestGpsCoordsForUserAction, useUserCoords } from '@/src/hooks/use-user-coords';
import { eventRuntimePhase, sortEventsByRuntime } from '@/src/lib/event-runtime';
import {
  centroidOfEvents,
  filterEventsForMapSearch,
  geocodeUsZip,
  parseMapSearchQuery,
} from '@/src/lib/event-map-search';
import { distanceMiles, formatDistance, type Coords } from '@/src/lib/geo';
import { capEventsNear, MAP_MARKER_LIMIT, MAP_SIDEBAR_LIMIT } from '@/src/lib/events-display-limits';
import { fetchPublicEvents } from '@/src/lib/events-query';
import { pagePadding } from '@/src/theme/layout';
import type { Event } from '@/src/types/database';

const DEFAULT_DELTA = { latitudeDelta: 0.45, longitudeDelta: 0.45 };
const MAP_NOW_MS = 60_000;

const FALLBACK_REGION: MapRegion = {
  latitude: 30.2672,
  longitude: -97.7431,
  ...DEFAULT_DELTA,
};

export default function ShopperMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const { coords } = useUserCoords();
  const fetchOrigin = useMapFetchOrigin(coords);
  const now = useNow(MAP_NOW_MS);

  const [events, setEvents] = useState<Event[]>([]);
  const [region, setRegion] = useState<MapRegion>(FALLBACK_REGION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
    let active = true;

    async function init() {
      const { data, error: queryError } = await fetchPublicEvents({
        forMap: true,
        near: fetchOrigin,
      });

      if (!active) return;

      if (queryError) {
        setError(queryError);
      } else {
        setEvents(data);
      }

      if (fetchOrigin) {
        setRegion({ ...fetchOrigin, ...DEFAULT_DELTA });
      }

      setLoading(false);
    }

    init();
    return () => {
      active = false;
    };
  }, [fetchOrigin]);

  const filteredEvents = useMemo(
    () => filterEventsForMapSearch(events, query, searchCenter),
    [events, query, searchCenter],
  );

  const sortOrigin = searchCenter ?? fetchOrigin ?? coords;

  const mapEvents = useMemo(
    () => capEventsNear(filteredEvents, sortOrigin, MAP_MARKER_LIMIT).items,
    [filteredEvents, sortOrigin],
  );

  useEffect(() => {
    if (!query.trim()) return;

    const parsed = parseMapSearchQuery(query);
    const target =
      parsed.zip && searchCenter
        ? searchCenter
        : centroidOfEvents(filteredEvents);

    if (!target) return;

    setSelectedEventId(null);
    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: parsed.zip ? 0.45 : 0.25,
        longitudeDelta: parsed.zip ? 0.45 : 0.25,
      },
      350,
    );
  }, [query, searchCenter, filteredEvents]);

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

  const sheetEvents = useMemo(
    () => sortedEvents.slice(0, MAP_SIDEBAR_LIMIT),
    [sortedEvents],
  );

  const distanceFor = useCallback(
    (event: Event): string | null => {
      const origin = searchCenter ?? coords;
      if (!origin || event.latitude == null || event.longitude == null) return null;
      return formatDistance(
        distanceMiles(origin, { latitude: event.latitude, longitude: event.longitude }),
      );
    },
    [coords, searchCenter],
  );

  const openEventDetail = useCallback((id: string) => {
    router.push(`/(shopper)/events/${id}`);
  }, []);

  const previewEvent = useCallback(
    (id: string) => {
      const event = mapEvents.find((item) => item.id === id);
      if (!event?.latitude || !event?.longitude) return;
      setSelectedEventId(id);
      mapRef.current?.animateToRegion(
        {
          latitude: event.latitude,
          longitude: event.longitude,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        },
        350,
      );
    },
    [mapEvents],
  );

  const recenterOnUser = useCallback(async () => {
    const gps = await requestGpsCoordsForUserAction();
    if (!gps) return;
    const next = { ...gps, ...DEFAULT_DELTA };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 400);
    setSelectedEventId(null);
  }, []);

  const handleSelectEvent = useCallback(
    (id: string) => {
      openEventDetail(id);
    },
    [openEventDetail],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <LoadingIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View
        className="flex-1 items-center justify-center bg-canvas"
        style={{ paddingHorizontal: pagePadding }}>
        <Text variant="subtitle" className="text-center">
          Couldn&apos;t load events: {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <EventMap
        events={mapEvents}
        initialRegion={region}
        mapRef={mapRef}
        selectedEventId={selectedEventId}
        getDistanceLabel={distanceFor}
        onPreviewEvent={previewEvent}
        onOpenEvent={openEventDetail}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: pagePadding,
          right: pagePadding,
        }}>
        <MapFloatingSearch
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          resultCount={query.trim() ? filteredEvents.length : undefined}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: pagePadding,
          top: '38%',
        }}>
        <MapFloatingControl
          icon="location-arrow"
          accessibilityLabel="Center on my location"
          onPress={recenterOnUser}
        />
        <View style={{ height: 10 }} />
        <MapFloatingControl
          icon="list"
          accessibilityLabel="View all events"
          onPress={() => router.push('/(shopper)/(tabs)/events')}
        />
      </View>

      <MapBottomSheet
        events={sheetEvents}
        totalCount={sortedEvents.length}
        selectedEventId={selectedEventId}
        distanceLabel={distanceFor}
        onSelectEvent={handleSelectEvent}
        onViewAll={() => router.push('/(shopper)/(tabs)/events')}
        now={now}
      />
    </View>
  );
}
