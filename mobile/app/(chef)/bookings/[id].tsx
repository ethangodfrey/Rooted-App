import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { BackButton } from '@/src/components/ui/back-button';
import { Button } from '@/src/components/ui/button';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import type { ChefBooking } from '@/src/types/database';

export default function ChefBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chef } = useAuth();
  const [booking, setBooking] = useState<ChefBooking | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('chef_bookings').select('*').eq('id', id).maybeSingle();
      setBooking(data as ChefBooking | null);
      if (data?.quoted_amount) setQuoteAmount(String(data.quoted_amount / 100));
      setLoading(false);
    }
    void load();
  }, [id]);

  async function sendQuote() {
    if (!booking || !chef) return;
    const cents = Math.round(Number(quoteAmount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Enter a valid quote amount.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('chef_bookings')
      .update({
        quoted_amount: cents,
        booking_status: 'quoted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('chef_id', chef.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.back();
  }

  if (loading) {
    return (
      <Screen>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen>
        <Text>Booking not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => router.back()} />
      <Text variant="title" className="mb-2">
        Booking inquiry
      </Text>
      <Text variant="subtitle" className="mb-4">
        {booking.event_date} · {booking.booking_status}
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

      <Text variant="heading" className="mb-2">
        Send quote
      </Text>
      <TextInput
        className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
        placeholder="Quote amount (USD)"
        keyboardType="decimal-pad"
        value={quoteAmount}
        onChangeText={setQuoteAmount}
      />

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <Button label="Send quote to customer" onPress={sendQuote} loading={saving} />
    </Screen>
  );
}
