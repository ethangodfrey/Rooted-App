import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { InteractionManager, Pressable, View } from 'react-native';

import { ActionRow } from '@/src/components/ui/action-row';
import { SuggestedProductCard } from '@/src/components/discover/suggested-product-card';
import { LeftoverCard } from '@/src/components/leftovers/leftover-card';
import { Card } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { SearchField } from '@/src/components/ui/search-field';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { formatEventDate, formatPrice } from '@/src/lib/format';
import { fetchCuratedLeftovers, type CuratedLeftover } from '@/src/lib/leftovers';
import { fetchSuggestedProducts, type SuggestedProduct } from '@/src/lib/suggested-products';
import { useAuth } from '@/src/hooks/use-auth';
import { useUserCoords } from '@/src/hooks/use-user-coords';
import { supabase } from '@/src/lib/supabase';

type Filter = 'all' | 'events' | 'vendors' | 'products';

interface EventResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  start_datetime: string;
}

interface VendorResult {
  id: string;
  business_name: string | null;
  category: string | null;
}

interface ProductResult {
  id: string;
  name: string;
  price: number;
  vendor_id: string;
  vendor: { business_name: string | null } | null;
}

interface Results {
  events: EventResult[];
  vendors: VendorResult[];
  products: ProductResult[];
}

const EMPTY: Results = { events: [], vendors: [], products: [] };

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'products', label: 'Products' },
];

export default function ShopperHomeScreen() {
  const { user, shopper } = useAuth();
  const { coords } = useUserCoords();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<Results>(EMPTY);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [leftovers, setLeftovers] = useState<CuratedLeftover[]>([]);
  const [leftoversLoading, setLeftoversLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  useEffect(() => {
    if (!active) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${trimmed}%`;
      const wantEvents = filter === 'all' || filter === 'events';
      const wantVendors = filter === 'all' || filter === 'vendors';
      const wantProducts = filter === 'all' || filter === 'products';

      const [eventsRes, vendorsRes, productsRes] = await Promise.all([
        wantEvents
          ? supabase
              .from('events')
              .select('id, name, city, state, start_datetime')
              .eq('visibility_status', 'public')
              .ilike('name', like)
              .order('start_datetime', { ascending: true })
              .limit(10)
          : Promise.resolve({ data: [] as EventResult[] }),
        wantVendors
          ? supabase
              .from('vendors')
              .select('id, business_name, category')
              .eq('approval_status', 'approved')
              .ilike('business_name', like)
              .limit(10)
          : Promise.resolve({ data: [] as VendorResult[] }),
        wantProducts
          ? supabase
              .from('products')
              .select('id, name, price, vendor_id, vendor:vendors(business_name)')
              .eq('status', 'active')
              .ilike('name', like)
              .limit(10)
          : Promise.resolve({ data: [] as ProductResult[] }),
      ]);

      if (cancelled) return;
      setResults({
        events: (eventsRes.data as EventResult[]) ?? [],
        vendors: (vendorsRes.data as VendorResult[]) ?? [],
        products: (productsRes.data as unknown as ProductResult[]) ?? [],
      });
      setLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, filter, active]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      async function loadSuggested() {
        setSuggestedLoading(true);
        try {
          const products = await fetchSuggestedProducts(
            shopper?.interests ?? [],
            { userCity: user?.city, userState: user?.state },
            8,
          );
          if (!cancelled) setSuggestedProducts(products);
        } catch {
          if (!cancelled) setSuggestedProducts([]);
        } finally {
          if (!cancelled) setSuggestedLoading(false);
        }
      }
      void loadSuggested();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [shopper?.interests, user?.city, user?.state]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      async function loadLeftovers() {
        setLeftoversLoading(true);
        try {
          const curated = await fetchCuratedLeftovers(
            {
              coords,
              userCity: user?.city,
              userState: user?.state,
            },
            6,
          );
          if (!cancelled) setLeftovers(curated);
        } catch {
          if (!cancelled) setLeftovers([]);
        } finally {
          if (!cancelled) setLeftoversLoading(false);
        }
      }
      void loadLeftovers();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [coords, user?.city, user?.state]);

  const totalResults =
    results.events.length + results.vendors.length + results.products.length;

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Discover local
      </Text>
      <Text variant="title" className="mb-4">
        Search
      </Text>

      <SearchField
        className="mb-4"
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Search events, vendors, products"
      />

      <View className="mb-5 flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      {!active ? (
        <View className="gap-3">
          <View className="mb-1">
            <Text variant="heading" className="mb-3">
              For you
            </Text>

            <Text variant="subtitle" className="mb-2 font-semibold">
              Suggested products
            </Text>
            {suggestedLoading ? (
              <LoadingIndicator />
            ) : suggestedProducts.length === 0 ? (
              <Text variant="caption" className="mb-4">
                No product matches yet for your interests — browse events to discover vendors.
              </Text>
            ) : (
              <View className="mb-4 gap-2">
                {suggestedProducts.map((product) => (
                  <SuggestedProductCard
                    key={product.id}
                    product={product}
                    onPress={() => router.push(`/(shopper)/products/${product.id}`)}
                  />
                ))}
              </View>
            )}

            <View className="mb-3 flex-row items-center justify-between">
              <Text variant="subtitle" className="mb-0 font-semibold">
                Leftovers near you
              </Text>
              <Pressable onPress={() => router.push('/(shopper)/leftovers')}>
                <Text variant="caption" className="font-semibold text-forest">
                  See all
                </Text>
              </Pressable>
            </View>
            {leftoversLoading ? (
              <LoadingIndicator />
            ) : leftovers.length === 0 ? (
              <Text variant="caption">No active deals right now — check after market days.</Text>
            ) : (
              <View className="gap-2">
                {leftovers.slice(0, 4).map((listing) => (
                  <LeftoverCard
                    key={listing.id}
                    listing={listing}
                    compact
                    onPress={() => router.push(`/(shopper)/leftovers/${listing.id}`)}
                  />
                ))}
              </View>
            )}
          </View>

          <Text variant="caption" className="mb-1">
            Type at least 2 characters to search, or jump in:
          </Text>
          <ActionRow
            icon="calendar"
            title="Browse events"
            subtitle="Markets and pop-ups near you."
            onPress={() => router.push('/(shopper)/(tabs)/events')}
          />
          <ActionRow
            icon="map-marker"
            title="Explore the map"
            subtitle="See events as pins around you."
            onPress={() => router.push('/(shopper)/(tabs)/map')}
          />
          <ActionRow
            icon="recycle"
            title="Market leftovers"
            subtitle="Rescue unsold goods sorted by time and distance."
            onPress={() => router.push('/(shopper)/leftovers')}
          />
        </View>
      ) : loading ? (
        <View className="items-center py-10">
          <LoadingIndicator />
        </View>
      ) : totalResults === 0 ? (
        <View className="items-center py-10">
          <FontAwesome name="search" size={26} color="#9CAF88" />
          <Text variant="subtitle" className="mt-3 text-center">
            No matches for &ldquo;{trimmed}&rdquo;
          </Text>
          <Text variant="caption" className="mt-1 text-center">
            Try a different spelling or filter.
          </Text>
        </View>
      ) : (
        <View className="gap-5">
          {results.events.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-3">
                Events
              </Text>
              <View className="gap-3">
                {results.events.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => router.push(`/(shopper)/events/${event.id}`)}>
                    <Card className="flex-row items-center px-4 py-3.5">
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-honeydew">
                        <FontAwesome name="calendar" size={16} color="#228B22" />
                      </View>
                      <View className="min-w-0 flex-1 pr-2">
                        <Text variant="body" className="font-semibold">
                          {event.name}
                        </Text>
                        <Text variant="caption" className="mt-0.5">
                          {formatEventDate(event.start_datetime)}
                          {event.city ? ` · ${event.city}` : ''}
                          {event.state ? `, ${event.state}` : ''}
                        </Text>
                      </View>
                      <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {results.vendors.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-3">
                Vendors
              </Text>
              <View className="gap-3">
                {results.vendors.map((vendor) => (
                  <Pressable
                    key={vendor.id}
                    onPress={() => router.push(`/(shopper)/vendors/${vendor.id}`)}>
                    <Card className="flex-row items-center px-4 py-3.5">
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-honeydew">
                        <FontAwesome name="shopping-bag" size={16} color="#228B22" />
                      </View>
                      <View className="min-w-0 flex-1 pr-2">
                        <Text variant="body" className="font-semibold">
                          {vendor.business_name ?? 'Vendor'}
                        </Text>
                        {vendor.category ? (
                          <Text variant="caption" className="mt-0.5">
                            {vendor.category}
                          </Text>
                        ) : null}
                      </View>
                      <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {results.products.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-3">
                Products
              </Text>
              <View className="gap-3">
                {results.products.map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => router.push(`/(shopper)/products/${product.id}`)}>
                    <Card className="flex-row items-center px-4 py-3.5">
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-honeydew">
                        <FontAwesome name="cutlery" size={16} color="#228B22" />
                      </View>
                      <View className="min-w-0 flex-1 pr-2">
                        <Text variant="body" className="font-semibold">
                          {product.name}
                        </Text>
                        <Text variant="caption" className="mt-0.5">
                          {formatPrice(product.price)}
                          {product.vendor?.business_name
                            ? ` · ${product.vendor.business_name}`
                            : ''}
                        </Text>
                      </View>
                      <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
