import { router, useLocalSearchParams } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { EventForm } from '@/src/components/admin/event-form';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { supabase } from '@/src/lib/supabase';
import type { Event } from '@/src/types/database';

export default function AdminEditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setEvent(null);
    } else if (!data) {
      setError('Event not found.');
      setEvent(null);
    } else {
      setEvent(data);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  if (loading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen scroll>
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error ?? 'Event not found.'}
          </Text>
        </Card>
        <Button label="Back to events" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-6">
        Edit event
      </Text>

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
        </Card>
      ) : null}

      <EventForm
        initial={event}
        submitLabel="Save changes"
        loading={saving}
        onSubmit={async (values) => {
          setSaving(true);
          setError(null);

          const { error: updateError } = await supabase
            .from('events')
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq('id', event.id);

          setSaving(false);

          if (updateError) {
            setError(updateError.message);
            return;
          }

          router.back();
        }}
      />

      <View className="mt-6">
        <Button label="Back to list" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
