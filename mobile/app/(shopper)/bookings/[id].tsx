import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import type { ChefBooking } from '@/src/types/database';

export default function CustomerBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<ChefBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBooking(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('chef_bookings')
      .select('*')
      .eq('id', id)
      .eq('customer_id', user.id)
      .maybeSingle();

    setBooking(data as ChefBooking | null);
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respondToQuote(nextStatus: 'confirmed' | 'declined') {
    if (!booking || !user?.id) return;

    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('chef_bookings')
      .update({
        booking_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('customer_id', user.id)
      .eq('booking_status', 'quoted');

    setActing(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Booking details',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <Screen>
          <LoadingIndicator />
        </Screen>
      ) : !booking ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            Booking not found.
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <Text variant="title" className="mb-1">
            {booking.event_date}
          </Text>
          <Text variant="caption" className="mb-4 capitalize">
            {booking.booking_status.replace(/_/g, ' ')}
          </Text>

          {booking.guest_count ? (
            <Text variant="body" className="mb-2">
              Guests: {booking.guest_count}
            </Text>
          ) : null}
          {booking.location_address ? (
            <Text variant="body" className="mb-2">
              Location: {booking.location_address}
            </Text>
          ) : null}
          {booking.special_requests ? (
            <Text variant="body" className="mb-4">
              Requests: {booking.special_requests}
            </Text>
          ) : null}
          {booking.chef_notes ? (
            <Card className="mb-4">
              <Text variant="heading" className="mb-1">
                Chef notes
              </Text>
              <Text variant="body">{booking.chef_notes}</Text>
            </Card>
          ) : null}

          {booking.booking_status === 'quoted' && booking.quoted_amount ? (
            <Card className="mb-4">
              <View className="mb-3 flex-row items-center gap-2">
                <FontAwesome name="tag" size={16} color="#228B22" />
                <Text variant="heading">Quote received</Text>
              </View>
              <Text variant="title" className="mb-4">
                {formatPrice(booking.quoted_amount)}
              </Text>
              <View className="gap-3">
                <Button
                  label="Accept quote"
                  loading={acting}
                  onPress={() => respondToQuote('confirmed')}
                />
                <Button
                  label="Decline quote"
                  variant="secondary"
                  loading={acting}
                  onPress={() => respondToQuote('declined')}
                />
              </View>
            </Card>
          ) : null}

          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        </Screen>
      )}
    </>
  );
}
