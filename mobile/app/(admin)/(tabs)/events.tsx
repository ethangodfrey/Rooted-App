import { router, useFocusEffect } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card, PressableCard } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { formatEventDate, formatEventTimeRange } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import type { Event, VisibilityStatus } from '@/src/types/database';

type Filter = 'all' | VisibilityStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'draft', label: 'Draft' },
];

export default function AdminEventsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase.from('events').select('*').order('start_datetime', { ascending: true });

    if (filter !== 'all') {
      query = query.eq('visibility_status', filter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setEvents([]);
    } else {
      setEvents(data ?? []);
    }

    setLoading(false);
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-1">
        Events
      </Text>
      <Text variant="subtitle" className="mb-4">
        Create and publish markets for vendors and shoppers.
      </Text>

      <Button
        label="Create event"
        className="mb-6"
        onPress={() => router.push('/(admin)/events/new')}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
        contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
          <View className="mt-3">
            <Button label="Retry" variant="secondary" onPress={loadEvents} />
          </View>
        </Card>
      ) : null}

      {loading ? (
        <View className="items-center py-12">
          <LoadingIndicator />
        </View>
      ) : events.length === 0 ? (
        <Card>
          <Text variant="heading" className="mb-1">
            No events yet
          </Text>
          <Text variant="caption">Create your first market event to seed the pilot.</Text>
        </Card>
      ) : (
        <View className="gap-4">
          {events.map((event) => (
            <PressableCard key={event.id} onPress={() => router.push(`/(admin)/events/${event.id}`)}>
              <View className="mb-2 flex-row items-center justify-between gap-2">
                <Text
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    event.visibility_status === 'public'
                      ? 'bg-forest-100 text-forest'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                  {event.visibility_status === 'public' ? 'Public' : 'Draft'}
                </Text>
                <Text variant="caption" className="capitalize">
                  {event.event_status}
                </Text>
              </View>
              <Text variant="heading" className="mb-1">
                {event.name}
              </Text>
              <Text variant="caption" className="mb-1">
                {formatEventDate(event.start_datetime)} ·{' '}
                {formatEventTimeRange(event.start_datetime, event.end_datetime)}
              </Text>
              {event.city ? (
                <Text variant="caption">
                  {event.city}
                  {event.state ? `, ${event.state}` : ''}
                </Text>
              ) : null}
            </PressableCard>
          ))}
        </View>
      )}
    </Screen>
  );
}
