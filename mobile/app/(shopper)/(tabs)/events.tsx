import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { PressableCard } from '@/src/components/ui/card';
import { EventLiveClock } from '@/src/components/events/event-live-clock';
import { EventStatusBadge } from '@/src/components/events/event-status-badge';
import { EventThumb } from '@/src/components/events/event-thumb';
import { Screen } from '@/src/components/ui/screen';
import { ScopeToggle } from '@/src/components/ui/scope-toggle';
import { Text } from '@/src/components/ui/text';
import { useEventsScope } from '@/src/hooks/use-events-scope';
import { useNow } from '@/src/hooks/use-now';
import { useUserCoords } from '@/src/hooks/use-user-coords';
import { EVENTS_PAGE_SIZE } from '@/src/lib/events-display-limits';
import { eventsForScope } from '@/src/lib/events-list';
import { eventRuntimePhase, sortEventsByRuntime } from '@/src/lib/event-runtime';
import { formatEventDate, formatEventTimeRange } from '@/src/lib/format';
import { distanceMiles, formatDistance } from '@/src/lib/geo';
import { fetchPublicEvents } from '@/src/lib/events-query';
import { colors } from '@/src/theme/colors';
import { layoutStyles } from '@/src/theme/layout';
import type { Event } from '@/src/types/database';

const SCOPE_OPTIONS = [
  { value: 'local' as const, label: 'Local events' },
  { value: 'nationwide' as const, label: 'Nationwide' },
];

const LIST_NOW_MS = 60_000;

const EventRow = memo(function EventRow({
  item,
  now,
  distance,
}: {
  item: Event;
  now: Date;
  distance: string | null;
}) {
  const phase = eventRuntimePhase(item, now);

  return (
    <PressableCard
      onPress={() => router.push(`/(shopper)/events/${item.id}`)}
      style={phase === 'closed' ? { opacity: 0.72 } : undefined}>
      <View className="flex-row gap-3">
        <EventThumb event={item} />
        <View className="flex-1">
          <View className="mb-1.5">
            <EventStatusBadge event={item} now={now} />
          </View>
          <Text variant="body" className="mb-1 font-semibold">
            {item.name}
          </Text>
          <Text variant="caption" className="mb-2">
            {formatEventDate(item.start_datetime)}
            {item.end_datetime
              ? ` · ${formatEventTimeRange(item.start_datetime, item.end_datetime, item.timezone)}`
              : ''}
          </Text>
          {item.city || item.state ? (
            <View className="flex-row items-center">
              <FontAwesome name="map-marker" size={12} color="#9CAF88" />
              <Text variant="caption" className="ml-1.5">
                {[item.city, item.state].filter(Boolean).join(', ')}
              </Text>
              {distance ? (
                <View
                  className="ml-2 px-2.5 py-1"
                  style={{ borderRadius: 999, backgroundColor: colors.honeydew }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                    {distance}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </PressableCard>
  );
});

export default function ShopperEventsScreen() {
  const { coords, source } = useUserCoords();
  const { scope, setScope, ready: scopeReady } = useEventsScope();
  const now = useNow(LIST_NOW_MS);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EVENTS_PAGE_SIZE);

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: queryError, truncated: isTruncated } = await fetchPublicEvents({
      scope,
      near: coords,
    });

    if (queryError) {
      setError(queryError);
      setEvents([]);
    } else {
      setEvents(data);
    }
    setTruncated(isTruncated);
    setVisibleCount(EVENTS_PAGE_SIZE);
  }, [scope, coords]);

  useEffect(() => {
    setLoading(true);
    loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const displayedEvents = useMemo(
    () => sortEventsByRuntime(eventsForScope(events, scope, coords), now),
    [events, scope, coords, now],
  );

  const visibleEvents = useMemo(
    () => displayedEvents.slice(0, visibleCount),
    [displayedEvents, visibleCount],
  );

  const distanceFor = useCallback(
    (event: Event): string | null => {
      if (scope !== 'local' || !coords || event.latitude == null || event.longitude == null) {
        return null;
      }
      return formatDistance(
        distanceMiles(coords, { latitude: event.latitude, longitude: event.longitude }),
      );
    },
    [coords, scope],
  );

  const scopeHint =
    scope === 'local'
      ? coords
        ? source === 'gps'
          ? 'Sorted by distance from your current location.'
          : 'Sorted by distance using your saved city or ZIP.'
        : 'Add a city during onboarding to sort local events by distance.'
      : truncated
        ? `Showing ${events.length} markets nationwide (sorted by date). Switch to Local or open the map for nearby markets.`
        : 'Showing public events across the US, sorted by date.';

  const renderItem = useCallback(
    ({ item }: { item: Event }) => (
      <EventRow item={item} now={now} distance={distanceFor(item)} />
    ),
    [now, distanceFor],
  );

  return (
    <Screen scroll={false}>
      <Text variant="eyebrow" className="mb-2">
        {scope === 'local' ? 'Near you' : 'Across the US'}
      </Text>
      <Text variant="title" className="mb-4">
        Events
      </Text>

      <EventLiveClock />

      {scopeReady ? (
        <View className="mb-4">
          <ScopeToggle value={scope} options={SCOPE_OPTIONS} onChange={setScope} />
          <Text variant="caption" className="mt-2">
            {scopeHint}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator />
        </View>
      ) : (
        <FlatList
          data={visibleEvents}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={layoutStyles.listContentLoose}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#228B22" />
          }
          ListEmptyComponent={
            <View className="mt-16 items-center">
              <Text variant="subtitle" className="text-center">
                {error ? `Couldn't load events: ${error}` : 'No upcoming events yet. Pull to refresh.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            visibleCount < displayedEvents.length ? (
              <Pressable
                className="mt-2 items-center rounded-card border border-primary/20 bg-honeydew px-4 py-3"
                onPress={() => setVisibleCount((count) => count + EVENTS_PAGE_SIZE)}>
                <Text variant="body" className="font-semibold text-primary">
                  Load more ({displayedEvents.length - visibleCount} remaining)
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={renderItem}
        />
      )}
    </Screen>
  );
}
