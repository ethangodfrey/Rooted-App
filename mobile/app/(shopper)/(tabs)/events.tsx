import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { WeekStrip } from '@/src/components/events/week-strip';
import { PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useNow } from '@/src/hooks/use-now';
import { useUserCoords } from '@/src/hooks/use-user-coords';
import { EVENTS_PAGE_SIZE } from '@/src/lib/events-display-limits';
import { eventsForScope } from '@/src/lib/events-list';
import type { EventsScope } from '@/src/lib/location-preferences';
import {
  eventDatesForWeekStrip,
  filterEventsByCalendarDay,
  findNearestDayWithEvents,
  formatCalendarDayLabel,
  startOfDay,
} from '@/src/lib/event-day-filter';
import { eventPlaceholderEmoji } from '@/src/lib/event-image';
import { eventRuntimePhase, sortEventsByRuntime } from '@/src/lib/event-runtime';
import { formatEventDate, formatEventTimeRange } from '@/src/lib/format';
import { distanceMiles, formatDistance } from '@/src/lib/geo';
import { fetchPublicEvents } from '@/src/lib/events-query';
import { colors } from '@/src/theme/colors';
import { layoutStyles } from '@/src/theme/layout';
import type { Event } from '@/src/types/database';

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
      className="flex-row gap-3"
      style={phase === 'closed' ? { opacity: 0.72 } : undefined}>
      <View
        className="h-[72px] w-[72px] items-center justify-center rounded-xl"
        style={{ backgroundColor: colors.warmSage }}>
        <Text className="text-3xl">{eventPlaceholderEmoji(item.market_type)}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="body" className="mb-1 font-semibold">
          {item.name}
        </Text>
        <Text variant="caption" className="mb-2">
          {formatEventDate(item.start_datetime)}
          {item.end_datetime
            ? ` · ${formatEventTimeRange(item.start_datetime, item.end_datetime, item.timezone)}`
            : ''}
          {distance ? ` · ${distance}` : ''}
        </Text>
        {item.city || item.state ? (
          <Text variant="caption">{[item.city, item.state].filter(Boolean).join(', ')}</Text>
        ) : null}
      </View>
    </PressableCard>
  );
});

export default function ShopperEventsScreen() {
  const { coords } = useUserCoords();
  const [scope, setScope] = useState<EventsScope>('local');
  const now = useNow(LIST_NOW_MS);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(EVENTS_PAGE_SIZE);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await fetchPublicEvents({
      scope,
      near: scope === 'local' ? coords : null,
    });

    if (queryError) {
      setError(queryError);
      setEvents([]);
    } else {
      setEvents(data);
    }
    setVisibleCount(EVENTS_PAGE_SIZE);
  }, [scope, coords]);

  useEffect(() => {
    setLoading(true);
    loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  useEffect(() => {
    setSelectedDate(startOfDay(now));
    setVisibleCount(EVENTS_PAGE_SIZE);
  }, [scope]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const scopedEvents = useMemo(
    () => eventsForScope(events, scope, coords),
    [events, scope, coords],
  );

  const displayedEvents = useMemo(
    () => sortEventsByRuntime(scopedEvents, now),
    [scopedEvents, now],
  );

  const dayFilteredEvents = useMemo(
    () => sortEventsByRuntime(filterEventsByCalendarDay(scopedEvents, selectedDate), now),
    [scopedEvents, selectedDate, now],
  );

  const stripEventDates = useMemo(
    () => eventDatesForWeekStrip(scopedEvents, now),
    [scopedEvents, now],
  );

  const nearestEventDay = useMemo(
    () => findNearestDayWithEvents(scopedEvents, selectedDate, now),
    [scopedEvents, selectedDate, now],
  );

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setVisibleCount(EVENTS_PAGE_SIZE);
  }, []);

  const visibleEvents = useMemo(
    () => dayFilteredEvents.slice(0, visibleCount),
    [dayFilteredEvents, visibleCount],
  );

  const distanceFor = useCallback(
    (event: Event): string | null => {
      if (!coords || event.latitude == null || event.longitude == null) {
        return null;
      }
      return formatDistance(
        distanceMiles(coords, { latitude: event.latitude, longitude: event.longitude }),
      );
    },
    [coords],
  );

  const renderItem = useCallback(
    ({ item }: { item: Event }) => <EventRow item={item} now={now} distance={distanceFor(item)} />,
    [now, distanceFor],
  );

  return (
    <Screen scroll={false}>
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <Text variant="caption" className="min-w-0 flex-1">
          {scope === 'local'
            ? 'Upcoming farmers markets and pop-ups near you.'
            : 'Markets nationwide — sorted by date.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setScope((current: EventsScope) => (current === 'local' ? 'nationwide' : 'local'))}>
          <Text variant="caption" className="font-semibold text-primary">
            {scope === 'local' ? 'Show all markets' : 'Nearby only'}
          </Text>
        </Pressable>
      </View>

      {!loading && displayedEvents.length > 0 ? (
        <WeekStrip
          eventDates={stripEventDates}
          now={now}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            displayedEvents.length === 0 ? (
              <View className="mt-16 items-center">
                <Text variant="subtitle" className="text-center">
                  {error ? `Couldn't load events: ${error}` : 'No upcoming events yet. Pull to refresh.'}
                </Text>
              </View>
            ) : (
              <View className="mt-16 items-center gap-2 px-4">
                <Text variant="subtitle" className="text-center">
                  No markets on this day.
                </Text>
                {nearestEventDay && nearestEventDay.getTime() !== selectedDate.getTime() ? (
                  <Pressable accessibilityRole="button" onPress={() => handleSelectDate(nearestEventDay)}>
                    <Text variant="body" className="font-semibold text-primary">
                      See markets on {formatCalendarDayLabel(nearestEventDay)}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            visibleCount < dayFilteredEvents.length ? (
              <Pressable
                className="mt-2 items-center rounded-card border border-primary/20 bg-warm-sage px-4 py-3 active:scale-[0.98]"
                onPress={() => setVisibleCount((count) => count + EVENTS_PAGE_SIZE)}>
                <Text variant="body" className="font-semibold text-primary">
                  Load more ({dayFilteredEvents.length - visibleCount} remaining)
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
