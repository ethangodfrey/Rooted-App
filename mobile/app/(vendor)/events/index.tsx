import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { EventStatusBadge } from '@/src/components/events/event-status-badge';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { useNow } from '@/src/hooks/use-now';
import { eventRuntimePhase, sortEventsByRuntime } from '@/src/lib/event-runtime';
import { formatEventDate, formatEventTimeRange } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import type { Event } from '@/src/types/database';

export default function VendorEventsScreen() {
  const { vendor } = useAuth();
  const now = useNow();
  const [events, setEvents] = useState<Event[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    setError(null);

    const [eventsRes, participationRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('visibility_status', 'public')
        .order('start_datetime', { ascending: true }),
      supabase.from('vendor_events').select('event_id').eq('vendor_id', vendor.id),
    ]);

    if (eventsRes.error) {
      setError(eventsRes.error.message);
    } else {
      setEvents(eventsRes.data ?? []);
    }
    if (!participationRes.error && participationRes.data) {
      setJoined(new Set(participationRes.data.map((row) => row.event_id as string)));
    }
  }, [vendor]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const toggle = useCallback(
    async (eventId: string) => {
      if (!vendor) return;
      setBusyId(eventId);
      setError(null);

      const isJoined = joined.has(eventId);
      if (isJoined) {
        const { error: delError } = await supabase
          .from('vendor_events')
          .delete()
          .eq('vendor_id', vendor.id)
          .eq('event_id', eventId);
        if (delError) {
          setError(delError.message);
        } else {
          setJoined((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        }
      } else {
        const { error: insError } = await supabase.from('vendor_events').upsert(
          {
            vendor_id: vendor.id,
            event_id: eventId,
            participation_status: 'approved',
          },
          { onConflict: 'vendor_id,event_id' },
        );
        if (insError) {
          setError(insError.message);
        } else {
          setJoined((prev) => new Set(prev).add(eventId));
        }
      }
      setBusyId(null);
    },
    [vendor, joined],
  );

  const sortedEvents = useMemo(() => sortEventsByRuntime(events, now), [events, now]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Event participation',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : (
        <FlatList
          className="bg-canvas"
          data={sortedEvents}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 pb-8 pt-4 gap-4"
          ListHeaderComponent={
            <View className="mb-2">
              <Text variant="subtitle">
                Join the events you&apos;ll attend. Shoppers will see you listed on those events.
              </Text>
              {vendor && vendor.approval_status !== 'approved' ? (
                <View className="mt-3 rounded-xl bg-forest-100 px-4 py-3">
                  <Text variant="caption" className="text-forest">
                    Your vendor account is {vendor.approval_status}. You can join events now, but
                    shoppers won&apos;t see you until an admin approves your account.
                  </Text>
                </View>
              ) : null}
              {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            <View className="mt-16 items-center">
              <Text variant="subtitle" className="text-center">
                No upcoming events to join yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isJoined = joined.has(item.id);
            const phase = eventRuntimePhase(item, now);
            return (
              <Card style={phase === 'closed' ? { opacity: 0.72 } : undefined}>
                <View className="mb-2">
                  <EventStatusBadge event={item} />
                </View>
                <View className="mb-2 flex-row items-center">
                  <FontAwesome name="calendar" size={13} color="#228B22" />
                  <Text variant="caption" className="ml-2 text-forest">
                    {formatEventDate(item.start_datetime)} ·{' '}
                    {formatEventTimeRange(item.start_datetime, item.end_datetime)}
                  </Text>
                </View>
                <Text variant="heading" className="mb-1">
                  {item.name}
                </Text>
                {item.city ? (
                  <View className="mb-3 flex-row items-center">
                    <FontAwesome name="map-marker" size={13} color="#9CAF88" />
                    <Text variant="caption" className="ml-2">
                      {item.city}
                      {item.state ? `, ${item.state}` : ''}
                    </Text>
                  </View>
                ) : (
                  <View className="mb-3" />
                )}
                <Button
                  label={isJoined ? 'Attending — tap to leave' : 'Join event'}
                  variant={isJoined ? 'secondary' : 'primary'}
                  loading={busyId === item.id}
                  onPress={() => toggle(item.id)}
                />
              </Card>
            );
          }}
        />
      )}
    </>
  );
}
