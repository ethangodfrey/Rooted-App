import { router, Stack, useLocalSearchParams } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatEventDate } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';

interface AttendedEvent {
  id: string;
  name: string;
  start_datetime: string;
}

interface QtyEntry {
  presale: string;
  inperson: string;
}

export default function ProductAvailabilityScreen() {
  const { id: productId } = useLocalSearchParams<{ id: string }>();
  const { vendor } = useAuth();
  const [events, setEvents] = useState<AttendedEvent[]>([]);
  const [quantities, setQuantities] = useState<Record<string, QtyEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    setError(null);

    const [participationRes, availabilityRes] = await Promise.all([
      supabase
        .from('vendor_events')
        .select('events!inner(id, name, start_datetime)')
        .eq('vendor_id', vendor.id),
      supabase
        .from('product_event_availability')
        .select('event_id, available_quantity_presale, available_quantity_inperson')
        .eq('product_id', productId),
    ]);

    if (participationRes.error) {
      setError(participationRes.error.message);
      setLoading(false);
      return;
    }

    const attended: AttendedEvent[] = (participationRes.data ?? [])
      .map((row) => {
        const ev = (row as { events: AttendedEvent | AttendedEvent[] }).events;
        return Array.isArray(ev) ? ev[0] : ev;
      })
      .filter((ev): ev is AttendedEvent => Boolean(ev))
      .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

    const existing: Record<string, QtyEntry> = {};
    for (const ev of attended) {
      existing[ev.id] = { presale: '0', inperson: '0' };
    }
    for (const row of availabilityRes.data ?? []) {
      const eid = row.event_id as string;
      existing[eid] = {
        presale: String(row.available_quantity_presale ?? 0),
        inperson: String(row.available_quantity_inperson ?? 0),
      };
    }

    setEvents(attended);
    setQuantities(existing);
    setLoading(false);
  }, [vendor, productId]);

  useEffect(() => {
    load();
  }, [load]);

  function setQty(eventId: string, field: keyof QtyEntry, value: string) {
    setQuantities((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], [field]: value.replace(/[^0-9]/g, '') },
    }));
  }

  async function handleSave() {
    setError(null);

    const rows = events.map((ev) => {
      const entry = quantities[ev.id] ?? { presale: '0', inperson: '0' };
      return {
        product_id: productId,
        event_id: ev.id,
        available_quantity_presale: Number.parseInt(entry.presale || '0', 10),
        available_quantity_inperson: Number.parseInt(entry.inperson || '0', 10),
      };
    });

    const invalid = rows.find(
      (r) =>
        !Number.isInteger(r.available_quantity_presale) ||
        !Number.isInteger(r.available_quantity_inperson) ||
        r.available_quantity_presale < 0 ||
        r.available_quantity_inperson < 0,
    );
    if (invalid) {
      setError('Quantities must be whole numbers of 0 or more.');
      return;
    }

    setSaving(true);
    const { error: upError } = await supabase
      .from('product_event_availability')
      .upsert(rows, { onConflict: 'product_id,event_id' });
    setSaving(false);

    if (upError) {
      setError(upError.message);
      return;
    }
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Event availability',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : (
        <Screen scroll>
          <Text variant="subtitle" className="mb-6">
            Set how many units are reservable online (presale) vs. held for in-person booth sales for
            each event you attend.
          </Text>

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          {events.length === 0 ? (
            <Text variant="subtitle" className="text-center">
              Join an event first (Dashboard → Event participation) to set availability.
            </Text>
          ) : (
            <View className="gap-4">
              {events.map((ev) => {
                const entry = quantities[ev.id] ?? { presale: '0', inperson: '0' };
                const total =
                  (Number.parseInt(entry.presale || '0', 10) || 0) +
                  (Number.parseInt(entry.inperson || '0', 10) || 0);
                return (
                  <Card key={ev.id}>
                    <Text variant="body" className="font-semibold">
                      {ev.name}
                    </Text>
                    <Text variant="caption" className="mb-3">
                      {formatEventDate(ev.start_datetime)}
                    </Text>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Input
                          label="Presale"
                          value={entry.presale}
                          onChangeText={(v) => setQty(ev.id, 'presale', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="In-person"
                          value={entry.inperson}
                          onChangeText={(v) => setQty(ev.id, 'inperson', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                        />
                      </View>
                    </View>
                    <Text variant="caption" className="mt-2">
                      Total stock for this event: {total}
                    </Text>
                  </Card>
                );
              })}

              <Button label="Save availability" loading={saving} onPress={handleSave} />
            </View>
          )}
        </Screen>
      )}
    </>
  );
}
