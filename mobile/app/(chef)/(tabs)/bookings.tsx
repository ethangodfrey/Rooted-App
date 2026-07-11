import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatCents } from '@/src/lib/role-utils';
import { supabase } from '@/src/lib/supabase';
import type { ChefBooking } from '@/src/types/database';

export default function ChefBookingsScreen() {
  const { chef } = useAuth();
  const [bookings, setBookings] = useState<ChefBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!chef?.id) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('chef_bookings')
      .select('*')
      .eq('chef_id', chef.id)
      .order('created_at', { ascending: false });

    setBookings((data ?? []) as ChefBooking[]);
    setLoading(false);
  }, [chef?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Text variant="title" className="mb-4">
            Booking inquiries
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingIndicator />
          ) : (
            <Text variant="caption">No booking inquiries yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(chef)/bookings/${item.id}`)}>
            <Text variant="body" className="mb-3 rounded-xl bg-white p-4">
              {item.event_date} · {item.booking_status}
              {item.quoted_amount ? ` · ${formatCents(item.quoted_amount)}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
