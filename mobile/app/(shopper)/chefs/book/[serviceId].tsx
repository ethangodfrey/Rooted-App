import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { ReviewsSection } from '@/src/components/reviews/reviews-section';
import { BackButton } from '@/src/components/ui/back-button';
import { Button } from '@/src/components/ui/button';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import type { ChefService } from '@/src/types/database';

export default function BookChefServiceScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { user } = useAuth();
  const [service, setService] = useState<ChefService | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [location, setLocation] = useState('');
  const [requests, setRequests] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('chef_services')
        .select('*')
        .eq('id', serviceId)
        .maybeSingle();
      setService(data as ChefService | null);
      setLoading(false);
    }
    void load();
  }, [serviceId]);

  async function handleSubmit() {
    if (!user?.id || !service) return;
    if (!eventDate.trim()) {
      setError('Enter an event date (YYYY-MM-DD).');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('chef_bookings').insert({
      customer_id: user.id,
      chef_id: service.chef_id,
      service_id: service.id,
      event_date: eventDate.trim(),
      guest_count: guestCount ? Number(guestCount) : null,
      location_address: location.trim() || null,
      special_requests: requests.trim() || null,
      booking_status: 'inquiry',
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.replace('/(shopper)/bookings');
  }

  if (loading) {
    return (
      <Screen>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!service) {
    return (
      <Screen>
        <Text>Service not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => router.back()} />
      <Text variant="title" className="mb-2">
        Request booking
      </Text>
      <Text variant="subtitle" className="mb-6">
        {service.service_name} — the chef will respond with a quote.
      </Text>

      <View className="gap-4">
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Event date (YYYY-MM-DD)"
          value={eventDate}
          onChangeText={setEventDate}
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Guest count"
          keyboardType="number-pad"
          value={guestCount}
          onChangeText={setGuestCount}
        />
        <TextInput
          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Location / address"
          value={location}
          onChangeText={setLocation}
        />
        <TextInput
          className="min-h-[100px] rounded-xl border border-gray-200 bg-white px-4 py-3"
          placeholder="Dietary needs and special requests"
          multiline
          value={requests}
          onChangeText={setRequests}
        />
      </View>

      {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}

      <Button className="mt-6" label="Submit inquiry" onPress={handleSubmit} loading={submitting} />

      <ReviewsSection targetType="service" targetId={service.id} />
    </Screen>
  );
}
