import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { TextArea } from '@/src/components/ui/text-area';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface EventOption {
  id: string;
  name: string;
}

export default function ManualSaleScreen() {
  const { vendor } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!vendor) return;
      const [productsRes, eventsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, price')
          .eq('vendor_id', vendor.id)
          .eq('status', 'active'),
        supabase.from('vendor_events').select('event:events(id, name)').eq('vendor_id', vendor.id),
      ]);
      if (!active) return;
      setProducts((productsRes.data as ProductOption[]) ?? []);
      const evRows =
        (eventsRes.data as unknown as { event: { id: string; name: string } | null }[]) ?? [];
      setEvents(evRows.filter((r) => r.event).map((r) => r.event!));
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [vendor]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const total = selectedProduct ? selectedProduct.price * quantity : 0;

  async function handleLog() {
    if (!vendor) return;
    if (!productId) {
      setError('Select a product.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('inventory_transactions').insert({
      vendor_id: vendor.id,
      product_id: productId,
      event_id: eventId,
      transaction_type: 'sale_manual',
      quantity_change: -quantity,
      source: 'manual',
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Log in-person sale',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : products.length === 0 ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            Add an active product first to log a sale.
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <Text className="mb-1.5 text-sm font-semibold text-ink">Product</Text>
          <View className="mb-5 gap-2">
            {products.map((p) => (
              <Pressable key={p.id} onPress={() => setProductId(p.id)}>
                <Card
                  className={`flex-row items-center justify-between ${
                    productId === p.id ? 'border-2 border-primary' : ''
                  }`}>
                  <Text variant="body" className="flex-1 pr-3 font-semibold">
                    {p.name}
                  </Text>
                  <Text variant="caption">{formatPrice(p.price)}</Text>
                </Card>
              </Pressable>
            ))}
          </View>

          {events.length > 0 ? (
            <>
              <Text className="mb-1.5 text-sm font-semibold text-ink">Event (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-5"
                contentContainerClassName="gap-2">
                <Chip label="None" selected={eventId === null} onPress={() => setEventId(null)} />
                {events.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.name}
                    selected={eventId === e.id}
                    onPress={() => setEventId(e.id)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text className="mb-1.5 text-sm font-semibold text-ink">Quantity</Text>
          <View className="mb-5 flex-row items-center gap-4">
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-11 w-11 items-center justify-center rounded-full bg-honeydew">
              <FontAwesome name="minus" size={14} color="#228B22" />
            </Pressable>
            <Text variant="title">{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((q) => q + 1)}
              className="h-11 w-11 items-center justify-center rounded-full bg-honeydew">
              <FontAwesome name="plus" size={14} color="#228B22" />
            </Pressable>
          </View>

          <TextArea
            label="Notes (optional)"
            className="mb-5"
            value={notes}
            onChangeText={setNotes}
            placeholder="Cash sale, booth walk-up..."
            minHeight={80}
          />

          <Card className="mb-4 flex-row items-center justify-between">
            <Text variant="body" className="font-semibold">
              Sale total
            </Text>
            <Text variant="subtitle">{formatPrice(total)}</Text>
          </Card>

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          <Button label="Log sale" loading={saving} disabled={!productId} onPress={handleLog} />
        </Screen>
      )}
    </>
  );
}
