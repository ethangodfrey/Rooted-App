import { router, Stack, useLocalSearchParams } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { DiscoverThumb } from '@/src/components/discover/discover-thumb';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { TextArea } from '@/src/components/ui/text-area';
import { useUserCoords } from '@/src/hooks/use-user-coords';
import { formatDistance } from '@/src/lib/geo';
import { formatPrice } from '@/src/lib/format';
import {
  curateLeftovers,
  fetchLeftoverById,
  formatExpiresIn,
  type CuratedLeftover,
} from '@/src/lib/leftovers';
import { useAuth } from '@/src/hooks/use-auth';
import { pickListingDisplayImage } from '@/src/lib/product-image';
import { supabase } from '@/src/lib/supabase';

export default function ShopperLeftoverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { coords } = useUserCoords();
  const [listing, setListing] = useState<CuratedLeftover | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const row = await fetchLeftoverById(id);
        if (!active) return;
        if (!row) {
          setError('Listing not found.');
          setListing(null);
        } else {
          const [curated] = curateLeftovers([row], {
            coords,
            userCity: user?.city,
            userState: user?.state,
          });
          setListing(curated ?? null);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load listing.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, coords, user?.city, user?.state]);

  async function handleReserve() {
    if (!listing) return;
    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('create_leftover_reservation', {
      p_leftover_id: listing.id,
      p_quantity: quantity,
      p_notes: notes.trim() || null,
    });

    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.replace(`/(shopper)/orders/${data as string}`);
  }

  if (loading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen scroll>
        <Text>{error ?? 'Listing not found.'}</Text>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Leftover',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <View className="mb-4 flex-row items-center gap-3">
          <DiscoverThumb
            imageUrl={pickListingDisplayImage(listing.media_url)}
            category={listing.vendor?.category ?? 'Food & Drink'}
            size="md"
          />
          <View className="flex-1">
            <Text variant="title" className="mb-1">
              {listing.title}
            </Text>
            <Text variant="caption">
              {listing.vendor?.business_name ?? 'Vendor'} · {formatPrice(listing.price_cents)}
            </Text>
          </View>
        </View>

        <Card className="mb-4">
          <Text variant="caption" className="mb-1 text-warn">
            {formatExpiresIn(listing.hoursLeft)} · {listing.quantity_remaining} available
          </Text>
          <Text variant="body" className="mb-2">
            Pickup: {listing.locationLabel}
            {listing.distanceMiles != null
              ? ` (${formatDistance(listing.distanceMiles)} away)`
              : ''}
          </Text>
          {listing.source_event?.name ? (
            <Text variant="caption" className="mb-2">
              From {listing.source_event.name}
            </Text>
          ) : null}
          {listing.description ? <Text variant="body">{listing.description}</Text> : null}
          {listing.pickup_notes ? (
            <Text variant="caption" className="mt-2">
              {listing.pickup_notes}
            </Text>
          ) : null}
        </Card>

        <View className="mb-4 flex-row items-center justify-between">
          <Text variant="body" className="font-semibold">
            Quantity
          </Text>
          <View className="flex-row items-center gap-4">
            <Button
              label="−"
              variant="secondary"
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            />
            <Text variant="heading" className="mb-0">
              {quantity}
            </Text>
            <Button
              label="+"
              variant="secondary"
              onPress={() =>
                setQuantity((q) => Math.min(listing.quantity_remaining, q + 1))
              }
            />
          </View>
        </View>

        <TextArea
          label="Notes for vendor (optional)"
          className="mb-4"
          value={notes}
          onChangeText={setNotes}
          placeholder="Pickup time, dietary questions..."
          minHeight={72}
        />

        {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

        <Button
          label={`Reserve · ${formatPrice(listing.price_cents * quantity)}`}
          loading={submitting}
          onPress={handleReserve}
        />
      </Screen>
    </>
  );
}
