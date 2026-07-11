import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import type { ChefBooking } from '@/src/types/database';

export default function CustomerBookingsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<ChefBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('chef_bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    setBookings((data ?? []) as ChefBooking[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Chef bookings',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen>
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8 pt-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            loading ? <LoadingIndicator /> : <Text variant="caption">No booking inquiries yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              className="mb-3"
              onPress={() => router.push(`/(shopper)/bookings/${item.id}`)}>
              <Card>
                <Text variant="body" className="font-semibold capitalize">
                  {item.booking_status.replace(/_/g, ' ')}
                </Text>
                <Text variant="caption" className="mt-1">
                  {item.event_date}
                  {item.quoted_amount ? ` · ${formatPrice(item.quoted_amount)}` : ''}
                </Text>
              </Card>
            </Pressable>
          )}
        />
      </Screen>
    </>
  );
}
