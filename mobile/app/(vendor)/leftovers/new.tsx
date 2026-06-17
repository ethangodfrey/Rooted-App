import { router, Stack } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { TextArea } from '@/src/components/ui/text-area';
import { Input } from '@/src/components/ui/input';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { expiresAtFromHours, EXPIRY_PRESETS } from '@/src/lib/leftovers';
import { pickAndUploadProductImage } from '@/src/lib/upload';
import { supabase } from '@/src/lib/supabase';

interface ProductOption {
  id: string;
  name: string;
  price: number;
  media_urls: string[];
}

interface EventOption {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
}

type PickupMode = 'vendor_area' | 'event';

export default function NewLeftoverScreen() {
  const { user, vendor } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [sourceEventId, setSourceEventId] = useState<string | null>(null);
  const [pickupMode, setPickupMode] = useState<PickupMode>('vendor_area');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expiryHours, setExpiryHours] = useState(12);
  const [pickupNotes, setPickupNotes] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    Promise.all([
      supabase
        .from('products')
        .select('id, name, price, media_urls')
        .eq('vendor_id', vendor.id)
        .eq('status', 'active'),
      supabase
        .from('vendor_events')
        .select('event:events(id, name, address, city, state, latitude, longitude)')
        .eq('vendor_id', vendor.id),
    ]).then(([productsRes, eventsRes]) => {
      setProducts((productsRes.data as ProductOption[]) ?? []);
      const rows =
        (eventsRes.data as unknown as { event: EventOption | null }[]) ?? [];
      setEvents(rows.filter((r) => r.event).map((r) => r.event!));
    });
  }, [vendor]);

  function selectProduct(id: string | null) {
    setProductId(id);
    if (!id) return;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setTitle(product.name);
    setPriceDollars((product.price / 100).toFixed(2));
    if (product.media_urls?.[0]) setMediaUrl(product.media_urls[0]);
  }

  async function handleAddPhoto() {
    if (!user) return;
    setUploading(true);
    try {
      const url = await pickAndUploadProductImage(user.id);
      if (url) setMediaUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!vendor) return;
    const qty = Number.parseInt(quantity, 10);
    const priceCents = Math.round(Number.parseFloat(priceDollars) * 100);
    if (!title.trim()) {
      setError('Add a title for this leftover.');
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError('Quantity must be at least 1.');
      return;
    }

    const event = sourceEventId ? events.find((e) => e.id === sourceEventId) : null;
    let pickupCity = vendor.sell_city;
    let pickupState = vendor.sell_state;
    let pickupAddress: string | null = null;
    let pickupLat: number | null = null;
    let pickupLng: number | null = null;

    if (pickupMode === 'event' && event) {
      pickupCity = event.city;
      pickupState = event.state;
      pickupAddress = event.address;
      pickupLat = Number(event.latitude);
      pickupLng = Number(event.longitude);
    } else if (pickupMode === 'event' && !sourceEventId) {
      setError('Select which market this leftover is from.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('leftover_listings').insert({
      vendor_id: vendor.id,
      product_id: productId,
      source_event_id: sourceEventId,
      title: title.trim(),
      description: description.trim() || null,
      media_url: mediaUrl,
      price_cents: priceCents,
      quantity_total: qty,
      quantity_remaining: qty,
      expires_at: expiresAtFromHours(expiryHours),
      pickup_address: pickupAddress,
      pickup_city: pickupCity,
      pickup_state: pickupState,
      pickup_latitude: pickupLat,
      pickup_longitude: pickupLng,
      pickup_notes: pickupNotes.trim() || null,
      status: 'active',
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
          title: 'List leftovers',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="subtitle" className="mb-4">
          Post unsold items after a market. Shoppers nearby see deals sorted by time left and
          pickup location.
        </Text>

        {products.length > 0 ? (
          <>
            <Text className="mb-2 text-sm font-semibold text-ink">From catalog (optional)</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              <Chip label="Custom" selected={productId === null} onPress={() => selectProduct(null)} />
              {products.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={productId === p.id}
                  onPress={() => selectProduct(p.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Input label="Title" className="mb-4" value={title} onChangeText={setTitle} />
        <TextArea
          label="Description"
          className="mb-4"
          value={description}
          onChangeText={setDescription}
          placeholder="What's left, condition, pickup instructions..."
          minHeight={88}
        />
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1">
            <Input
              label="Price ($)"
              value={priceDollars}
              onChangeText={setPriceDollars}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Input
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text className="mb-2 text-sm font-semibold text-ink">Available for</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {EXPIRY_PRESETS.map((preset) => (
            <Chip
              key={preset.hours}
              label={preset.label}
              selected={expiryHours === preset.hours}
              onPress={() => setExpiryHours(preset.hours)}
            />
          ))}
        </View>

        <Text className="mb-2 text-sm font-semibold text-ink">Pickup location</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          <Chip
            label="My area"
            selected={pickupMode === 'vendor_area'}
            onPress={() => setPickupMode('vendor_area')}
          />
          <Chip
            label="From market"
            selected={pickupMode === 'event'}
            onPress={() => setPickupMode('event')}
            disabled={events.length === 0}
          />
        </View>

        {pickupMode === 'event' && events.length > 0 ? (
          <View className="mb-4 flex-row flex-wrap gap-2">
            {events.map((event) => (
              <Chip
                key={event.id}
                label={event.name}
                selected={sourceEventId === event.id}
                onPress={() => setSourceEventId(event.id)}
              />
            ))}
          </View>
        ) : (
          <Card className="mb-4">
            <Text variant="caption">
              Pickup near {vendor?.sell_city ?? 'your city'}, {vendor?.sell_state ?? 'your state'}
            </Text>
          </Card>
        )}

        <TextArea
          label="Pickup notes (optional)"
          className="mb-4"
          value={pickupNotes}
          onChangeText={setPickupNotes}
          placeholder="e.g. Text when you arrive, porch pickup, fridge in garage..."
          minHeight={72}
        />

        <View className="mb-4">
          <Button
            label={uploading ? 'Uploading…' : mediaUrl ? 'Change photo' : 'Add photo (optional)'}
            variant="secondary"
            loading={uploading}
            onPress={handleAddPhoto}
          />
        </View>

        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
        <Button label="Publish leftover" loading={saving} onPress={handlePublish} />
      </Screen>
    </>
  );
}
