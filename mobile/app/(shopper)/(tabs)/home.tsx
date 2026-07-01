import { FontAwesome } from '@expo/vector-icons';

import { router } from 'expo-router';

import { useEffect, useMemo, useState, memo, type ReactNode } from 'react';

import { InteractionManager, Pressable, ScrollView, View } from 'react-native';



import { Card } from '@/src/components/ui/card';

import { HomeSectionSkeleton } from '@/src/components/ui/skeleton';

import { Screen } from '@/src/components/ui/screen';

import { Text } from '@/src/components/ui/text';

import { useAuth } from '@/src/hooks/use-auth';

import { useNow } from '@/src/hooks/use-now';

import { useUserCoords } from '@/src/hooks/use-user-coords';

import { eventRuntimePhase, eventRuntimeHint, type EventRuntimeFields } from '@/src/lib/event-runtime';

import { formatEventDate, formatPrice } from '@/src/lib/format';

import { fetchNearbyEvents, formatDistanceKm, type NearbyEvent } from '@/src/lib/geo-search';

import { fetchCuratedLeftovers, type CuratedLeftover } from '@/src/lib/leftovers';

import { getMarketContext } from '@/src/lib/market-context';

import { fetchSuggestedProducts, type SuggestedProduct } from '@/src/lib/suggested-products';

import { colors } from '@/src/theme/colors';



function HScrollSection({

  title,

  actionLabel,

  onAction,

  children,

}: {

  title: string;

  actionLabel?: string;

  onAction?: () => void;

  children: ReactNode;

}) {

  return (

    <View className="mb-6">

      <View className="mb-3 flex-row items-center justify-between">

        <View className="flex-row items-center gap-2.5">

          <View className="h-5 w-1 rounded-full bg-primary" />

          <Text variant="heading">{title}</Text>

        </View>

        {actionLabel && onAction ? (

          <Pressable onPress={onAction} className="rounded-full px-2 py-1 active:opacity-70">

            <Text variant="caption" className="font-semibold text-primary">

              {actionLabel}

            </Text>

          </Pressable>

        ) : null}

      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>

        {children}

      </ScrollView>

    </View>

  );

}



const TileCard = memo(function TileCard({
  title,
  meta,
  badge,
  emoji,
  onPress,
}: {
  title: string;
  meta?: string;
  badge?: string;
  emoji?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="active:scale-[0.98]">
      <Card className="w-56 overflow-hidden p-0" style={{ width: 220 }}>
        <View
          className="h-[72px] items-center justify-center"
          style={{ backgroundColor: colors.warmSage }}>
          <Text className="text-3xl">{emoji ?? '🌿'}</Text>
        </View>
        <View className="px-4 py-4">
          {badge ? (
            <View className="mb-2 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: colors.warmSageAlt }}>
              <Text className="text-xs font-semibold text-accent">{badge}</Text>
            </View>
          ) : null}
          <Text variant="body" className="font-semibold" numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text variant="caption" className="mt-1" numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
});



export default function ShopperHomeScreen() {

  const { user, shopper } = useAuth();

  const { coords } = useUserCoords();

  const now = useNow(60_000);

  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);

  const [leftovers, setLeftovers] = useState<CuratedLeftover[]>([]);

  const [nearbyEvents, setNearbyEvents] = useState<NearbyEvent[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(true);

  const [loadingNearby, setLoadingNearby] = useState(true);

  const [loadingLeftovers, setLoadingLeftovers] = useState(true);



  const context = useMemo(() => getMarketContext(now, user?.name), [now, user?.name]);



  const lat = coords?.latitude ?? null;

  const lng = coords?.longitude ?? null;

  const nearbyCoords = useMemo(

    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),

    [lat, lng],

  );



  useEffect(() => {

    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {

      async function load() {

        setLoadingProducts(true);

        setLoadingNearby(true);

        setLoadingLeftovers(true);



        const products = await fetchSuggestedProducts(

          shopper?.interests ?? [],

          { userCity: user?.city, userState: user?.state },

          8,

        ).catch(() => [] as SuggestedProduct[]);



        if (cancelled) return;

        setSuggestedProducts(products);

        setLoadingProducts(false);



        const eventsPromise = nearbyCoords

          ? fetchNearbyEvents(nearbyCoords, { limit: 12 }).catch(() => [] as NearbyEvent[])

          : Promise.resolve([] as NearbyEvent[]);



        const [events, curated] = await Promise.all([

          eventsPromise,

          fetchCuratedLeftovers(

            { coords: nearbyCoords, userCity: user?.city, userState: user?.state },

            6,

          ).catch(() => [] as CuratedLeftover[]),

        ]);



        if (cancelled) return;

        setNearbyEvents(events ?? []);

        setLoadingNearby(false);

        setLeftovers(curated);

        setLoadingLeftovers(false);

      }

      void load();

    });

    return () => {

      cancelled = true;

      task.cancel();

    };

  }, [nearbyCoords, shopper?.interests, user?.city, user?.state]);



  const openNow = useMemo(
    () => nearbyEvents.filter((e) => eventRuntimePhase(e as EventRuntimeFields, now) === 'live'),
    [nearbyEvents, now],
  );

  const nextOpeningHint = useMemo(() => {
    const upcoming = nearbyEvents
      .filter((e) => eventRuntimePhase(e as EventRuntimeFields, now) === 'upcoming')
      .map((e) => eventRuntimeHint(e as EventRuntimeFields, now))
      .filter(Boolean);
    return upcoming[0] ?? null;
  }, [nearbyEvents, now]);



  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const newThisWeek = useMemo(

    () => nearbyEvents.filter((e) => new Date(e.start_datetime).getTime() >= weekAgo),

    [nearbyEvents, weekAgo],

  );



  return (

    <Screen scroll>

      <Text variant="title" className="mb-1">

        {context.greeting}

      </Text>

      <Text variant="subtitle" className="mb-5">

        {context.subtitle}

      </Text>



      <Pressable
        onPress={() =>
          router.push(context.isMarketDay ? '/(shopper)/(tabs)/map' : '/(shopper)/(tabs)/events')
        }
        className="mb-6 active:scale-[0.98]">
        <Card
          subtle={!context.isMarketDay}
          className={`flex-row items-center gap-3 px-5 py-5 ${context.isMarketDay ? 'border border-accent/25 bg-warm-sage-alt' : 'bg-warm-sage'}`}>
          <View className="min-w-0 flex-1">
            <Text variant="eyebrow" className="mb-2 text-accent">
              {context.isMarketDay ? 'Market day' : 'Discover local'}
            </Text>
            <Text variant="heading" className="mb-2">
              {context.isMarketDay ? 'Weekend markets are open' : 'Your neighborhood food scene'}
            </Text>
            <Text variant="caption">
              {context.isMarketDay
                ? 'See live pins and upcoming markets on the map.'
                : 'Browse markets, reserve pickup, and support local vendors.'}
            </Text>
          </View>
          <Text className="text-2xl text-primary">›</Text>
        </Card>
      </Pressable>



      {nearbyCoords ? (

        loadingNearby ? (

          <HomeSectionSkeleton />

        ) : (

          <HScrollSection title="Open now" actionLabel="Map" onAction={() => router.push('/(shopper)/(tabs)/map')}>

            {openNow.length === 0 ? (

              <View className="rounded-card bg-warm-sage px-4 py-5">

                <Text variant="caption" className="max-w-xs">

                  {nextOpeningHint ?? 'No markets open right now.'}

                </Text>

              </View>

            ) : (

              openNow.map((event) => (

                <TileCard

                  key={event.id}

                  badge="Live"

                  emoji="🧺"

                  title={event.name}

                  meta={[event.city, formatDistanceKm(event.distance_km)].filter(Boolean).join(' · ')}

                  onPress={() => router.push(`/(shopper)/events/${event.id}`)}

                />

              ))

            )}

          </HScrollSection>

        )

      ) : null}



      {loadingProducts ? (

        <HomeSectionSkeleton />

      ) : (

        <HScrollSection

          title="New this week"

          actionLabel="All markets"

          onAction={() => router.push('/(shopper)/(tabs)/events')}>

          {newThisWeek.length > 0

            ? newThisWeek.slice(0, 8).map((event) => (

                <TileCard

                  key={event.id}

                  emoji="🌿"

                  title={event.name}

                  meta={formatEventDate(event.start_datetime)}

                  onPress={() => router.push(`/(shopper)/events/${event.id}`)}

                />

              ))

            : suggestedProducts.slice(0, 6).map((product) => (

                <TileCard

                  key={product.id}

                  title={product.name}

                  meta={`${product.vendor?.business_name ?? 'Vendor'} · ${formatPrice(product.price)}`}

                  onPress={() => router.push(`/(shopper)/products/${product.id}`)}

                />

              ))}

        </HScrollSection>

      )}



      <HScrollSection title="Updates" actionLabel="See all" onAction={() => router.push('/(shopper)/(tabs)/feed')}>

        <TileCard

          title="From your saved vendors"

          meta="Postcards from markets, new products, and vendor news."

          onPress={() => router.push('/(shopper)/(tabs)/feed')}

        />

      </HScrollSection>



      {loadingLeftovers ? null : leftovers.length > 0 ? (

        <HScrollSection

          title="Leftovers near you"

          actionLabel="See all"

          onAction={() => router.push('/(shopper)/leftovers')}>

          {leftovers.slice(0, 5).map((listing) => (

            <TileCard

              key={listing.id}

              title={listing.title}

              meta={formatPrice(listing.price_cents)}

              onPress={() => router.push(`/(shopper)/leftovers/${listing.id}`)}

            />

          ))}

        </HScrollSection>

      ) : null}



      <Pressable

        onPress={() => router.push('/(shopper)/(tabs)/search')}

        className="mt-2 flex-row items-center rounded-2xl border border-stone/20 bg-surface/70 px-4 py-3.5 active:opacity-90">

        <FontAwesome name="search" size={16} color={colors.muted} />

        <Text variant="caption" className="ml-3">

          Search markets, vendors, chefs…

        </Text>

      </Pressable>

    </Screen>

  );

}

