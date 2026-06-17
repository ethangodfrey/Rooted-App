import { router, Stack, useFocusEffect } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { formatExpiresIn, type LeftoverListing } from '@/src/lib/leftovers';
import { supabase } from '@/src/lib/supabase';

export default function VendorLeftoversScreen() {
  const { vendor } = useAuth();
  const [listings, setListings] = useState<LeftoverListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!vendor) return;
    setLoading(true);
    const { data } = await supabase
      .from('leftover_listings')
      .select('id, title, price_cents, quantity_remaining, expires_at, status, created_at')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setListings((data as LeftoverListing[]) ?? []);
    setLoading(false);
  }, [vendor]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function cancelListing(id: string) {
    await supabase
      .from('leftover_listings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Leftovers',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="subtitle" className="mb-4">
          Manage post-market deals. Listings expire automatically based on the window you choose.
        </Text>

        <Button
          label="+ List leftovers"
          className="mb-4"
          onPress={() => router.push('/(vendor)/leftovers/new')}
        />

        {loading ? (
          <Text variant="caption">Loading…</Text>
        ) : listings.length === 0 ? (
          <Card>
            <Text variant="heading" className="mb-1">
              No leftovers listed
            </Text>
            <Text variant="caption">
              After a market day, list unsold bread, produce, or crafts before they go to waste.
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {listings.map((listing) => {
              const hoursLeft = Math.max(
                0,
                (new Date(listing.expires_at).getTime() - Date.now()) / (1000 * 60 * 60),
              );
              return (
                <Card key={listing.id}>
                  <Text variant="heading" className="mb-1">
                    {listing.title}
                  </Text>
                  <Text variant="caption" className="mb-2">
                    {formatPrice(listing.price_cents)} · {listing.quantity_remaining} left ·{' '}
                    {listing.status}
                    {listing.status === 'active' ? ` · ${formatExpiresIn(hoursLeft)}` : ''}
                  </Text>
                  {listing.status === 'active' ? (
                    <Button
                      label="Cancel listing"
                      variant="ghost"
                      onPress={() => cancelListing(listing.id)}
                    />
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
    </>
  );
}
