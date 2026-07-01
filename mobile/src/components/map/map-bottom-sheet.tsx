import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useRef, useState, memo } from 'react';
import { Dimensions, FlatList, PanResponder, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableCard } from '@/src/components/ui/card';
import { EventLiveClock } from '@/src/components/events/event-live-clock';
import { EventStatusBadge } from '@/src/components/events/event-status-badge';
import { Text } from '@/src/components/ui/text';
import { eventRuntimePhase } from '@/src/lib/event-runtime';
import { formatEventDate } from '@/src/lib/format';
import { colors } from '@/src/theme/colors';
import { floatingShadow, radius } from '@/src/theme/layout';
import type { Event } from '@/src/types/database';

interface MapBottomSheetProps {
  events: Event[];
  totalCount: number;
  selectedEventId?: string | null;
  distanceLabel?: (event: Event) => string | null;
  onSelectEvent: (id: string) => void;
  onViewAll?: () => void;
  now?: Date;
}

const SPRING = { damping: 22, stiffness: 220 };
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const EventPreviewCard = memo(function EventPreviewCard({
  event,
  selected,
  distance,
  onPress,
  now,
}: {
  event: Event;
  selected: boolean;
  distance: string | null;
  onPress: () => void;
  now: Date;
}) {
  const phase = eventRuntimePhase(event, now);

  return (
    <PressableCard
      onPress={onPress}
      style={{
        width: 260,
        borderWidth: selected ? 2 : 0,
        borderColor: colors.primary,
        opacity: phase === 'closed' ? 0.72 : 1,
      }}>
      <View className="mb-2">
        <EventStatusBadge event={event} showHint now={now} />
      </View>
      <Text variant="body" className="mb-1 font-semibold" numberOfLines={2}>
        {event.name}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FontAwesome name="map-marker" size={12} color={colors.sage} />
        <Text variant="caption" className="ml-1.5 flex-1" numberOfLines={1}>
          {[event.city, event.state].filter(Boolean).join(', ') || 'Location TBA'}
        </Text>
        {distance ? (
          <Text variant="caption" className="ml-2 font-semibold text-primary">
            {distance}
          </Text>
        ) : null}
      </View>
    </PressableCard>
  );
});

const EventListRow = memo(function EventListRow({
  event,
  selected,
  distance,
  onPress,
  now,
}: {
  event: Event;
  selected: boolean;
  distance: string | null;
  onPress: () => void;
  now: Date;
}) {
  const phase = eventRuntimePhase(event, now);

  return (
    <PressableCard
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5"
      style={{
        borderWidth: selected ? 2 : 0,
        borderColor: colors.primary,
        opacity: phase === 'closed' ? 0.72 : 1,
      }}>
      <View
        style={{
          marginRight: 12,
          height: 40,
          width: 40,
          borderRadius: radius.card,
          backgroundColor: phase === 'live' ? colors.honeydew : phase === 'closed' ? '#F4F4F5' : colors.honeydew,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: 14, color: phase === 'closed' ? colors.muted : colors.primary }}>
          {phase === 'live' ? '●' : phase === 'closed' ? '◼' : '◷'}
        </Text>
      </View>
      <View style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
        <View className="mb-1">
          <EventStatusBadge event={event} showHint now={now} />
        </View>
        <Text variant="body" className="font-semibold" numberOfLines={1}>
          {event.name}
        </Text>
        <Text variant="caption" className="mt-0.5" numberOfLines={1}>
          {formatEventDate(event.start_datetime)}
          {[event.city, event.state].filter(Boolean).length
            ? ` · ${[event.city, event.state].filter(Boolean).join(', ')}`
            : ''}
        </Text>
      </View>
      {distance ? (
        <Text variant="caption" className="font-semibold text-primary">
          {distance}
        </Text>
      ) : (
        <FontAwesome name="chevron-right" size={12} color={colors.sage} />
      )}
    </PressableCard>
  );
});

export function MapBottomSheet({
  events,
  totalCount,
  selectedEventId,
  distanceLabel,
  onSelectEvent,
  onViewAll,
  now: nowProp,
}: MapBottomSheetProps) {
  const sheetNow = nowProp ?? new Date();
  const insets = useSafeAreaInsets();
  const tabBarSpace = Math.max(insets.bottom, 8) + 56;
  const maxSheetHeight = SCREEN_HEIGHT * 0.78;
  const minSheetHeight = 210 + tabBarSpace;
  const hiddenOffset = maxSheetHeight - minSheetHeight;

  const translateY = useSharedValue(hiddenOffset);
  const dragStartY = useRef(hiddenOffset);
  const [expanded, setExpanded] = useState(false);

  const snapTo = useCallback(
    (toExpanded: boolean) => {
      const target = toExpanded ? 0 : hiddenOffset;
      translateY.value = withSpring(target, SPRING);
      setExpanded(toExpanded);
    },
    [hiddenOffset, translateY],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > Math.abs(gesture.dx) && Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        dragStartY.current = translateY.value;
      },
      onPanResponderMove: (_, gesture) => {
        const next = dragStartY.current + gesture.dy;
        translateY.value = Math.min(hiddenOffset, Math.max(0, next));
      },
      onPanResponderRelease: (_, gesture) => {
        const mid = hiddenOffset / 2;
        const shouldExpand = translateY.value < mid || gesture.vy < -0.4;
        snapTo(shouldExpand);
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
      }}>
      <Animated.View
        style={[
          floatingShadow,
          sheetStyle,
          {
            height: maxSheetHeight,
            borderTopLeftRadius: radius.card + 4,
            borderTopRightRadius: radius.card + 4,
            backgroundColor: colors.white,
            paddingBottom: tabBarSpace,
          },
        ]}>
        {/* Drag zone — always fixed at top of sheet */}
        <View {...panResponder.panHandlers}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#E5E7EB',
              }}
            />
          </View>

          <Pressable
            onPress={() => snapTo(!expanded)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 12,
            }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="heading">Nearby events</Text>
                <FontAwesome
                  name={expanded ? 'chevron-down' : 'chevron-up'}
                  size={12}
                  color={colors.muted}
                  style={{ marginLeft: 6, marginTop: 2 }}
                />
              </View>
              <Text variant="caption" className="mt-0.5">
                {events.length} of {totalCount} on map · pull {expanded ? 'down' : 'up'} for{' '}
                {expanded ? 'less' : 'more'}
              </Text>
              <View style={{ marginTop: 10 }}>
                <EventLiveClock compact />
              </View>
            </View>
            {onViewAll ? (
              <Pressable
                onPress={onViewAll}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: radius.pill,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}>
                <Text style={{ color: colors.white, fontSize: 14, fontWeight: '600' }}>
                  View all
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        </View>

        {events.length === 0 ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Text variant="caption">No events match your search in this area.</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={events}
              keyExtractor={(item) => `preview-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 12 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => (
                <EventPreviewCard
                  event={item}
                  selected={selectedEventId === item.id}
                  distance={distanceLabel?.(item) ?? null}
                  onPress={() => onSelectEvent(item.id)}
                  now={sheetNow}
                />
              )}
            />

            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text variant="heading">All events</Text>
            </View>

            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews
              renderItem={({ item }) => (
                <EventListRow
                  event={item}
                  selected={selectedEventId === item.id}
                  distance={distanceLabel?.(item) ?? null}
                  onPress={() => onSelectEvent(item.id)}
                  now={sheetNow}
                />
              )}
            />
          </>
        )}
      </Animated.View>
    </View>
  );
}
