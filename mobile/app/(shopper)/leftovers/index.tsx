import { router, Stack } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { LeftoverCard } from '@/src/components/leftovers/leftover-card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { useUserCoords } from '@/src/hooks/use-user-coords';
import {
  fetchCuratedLeftovers,
  fetchNearbyCuratedLeftovers,
  type CuratedLeftover,
} from '@/src/lib/leftovers';

export default function ShopperLeftoversScreen() {
  const { user } = useAuth();
  const { coords } = useUserCoords();
  const [listings, setListings] = useState<CuratedLeftover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable coords object keyed on primitives — useUserCoords returns a fresh
  // reference each resolve, so memoizing avoids re-running the load effect.
  const lat = coords?.latitude ?? null;
  const lng = coords?.longitude ?? null;
  const nearbyCoords = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        // Prefer server-side distance ranking; fall back to client curation when
        // coords are missing or the geo RPC is unavailable/errors.
        let result: CuratedLeftover[] | null = null;
        if (nearbyCoords) {
          try {
            result = await fetchNearbyCuratedLeftovers(nearbyCoords);
          } catch {
            result = null;
          }
        }
        if (result == null) {
          result = await fetchCuratedLeftovers({
            coords: nearbyCoords,
            userCity: user?.city,
            userState: user?.state,
          });
        }
        if (!active) return;
        setListings(result);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load leftovers.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [nearbyCoords, user?.city, user?.state]);

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
      <Screen scroll={false}>
        <Text variant="eyebrow" className="mb-2">
          Near you
        </Text>
        <Text variant="title" className="mb-1">
          Market leftovers
        </Text>
        <Text variant="subtitle" className="mb-4">
          Sorted by time left and pickup distance — rescue great food and goods before they expire.
        </Text>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <LoadingIndicator />
          </View>
        ) : error ? (
          <Text className="text-danger">{error}</Text>
        ) : listings.length === 0 ? (
          <Text variant="caption">
            No active leftovers nearby right now. Check back after market days.
          </Text>
        ) : (
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {listings.map((listing) => (
              <LeftoverCard
                key={listing.id}
                listing={listing}
                onPress={() => router.push(`/(shopper)/leftovers/${listing.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </Screen>
    </>
  );
}
