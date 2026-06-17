import { router } from 'expo-router';
import { useState } from 'react';

import { EventForm } from '@/src/components/admin/event-form';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { supabase } from '@/src/lib/supabase';

export default function AdminCreateEventScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-6">
        New event
      </Text>

      {error ? (
        <Text variant="body" className="mb-4 text-red-700">
          {error}
        </Text>
      ) : null}

      <EventForm
        submitLabel="Create event"
        loading={loading}
        onSubmit={async (values) => {
          setLoading(true);
          setError(null);

          const { data, error: insertError } = await supabase
            .from('events')
            .insert({ ...values, updated_at: new Date().toISOString() })
            .select('id')
            .single();

          setLoading(false);

          if (insertError) {
            setError(insertError.message);
            return;
          }

          router.replace(`/(admin)/events/${data.id}`);
        }}
      />
    </Screen>
  );
}
