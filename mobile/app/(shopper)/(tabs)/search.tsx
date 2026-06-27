import { FontAwesome } from '@expo/vector-icons';

import { router } from 'expo-router';

import { useEffect, useMemo, useState } from 'react';

import { Pressable, View } from 'react-native';

import { ChefCard } from '@/src/components/chef/chef-card';
import { DiscoverBrowseFeed } from '@/src/components/discover/discover-browse-feed';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Chip } from '@/src/components/ui/chip';
import { SearchField } from '@/src/components/ui/search-field';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { VendorCard } from '@/src/components/vendor/vendor-card';
import { useAuth } from '@/src/hooks/use-auth';
import { useSavedVendors } from '@/src/hooks/use-saved-vendors';
import { useUserCoords } from '@/src/hooks/use-user-coords';
import { fetchDiscoverFeed, type DiscoverFeedData } from '@/src/lib/discover-feed';
import { formatEventDate, formatPrice } from '@/src/lib/format';
import { formatDistanceKm } from '@/src/lib/geo-search';
import { formatCents } from '@/src/lib/role-utils';
import {
  runUnifiedSearch,
  unifiedSearchTotal,
  type UnifiedSearchFilter,
  type UnifiedSearchResults,
} from '@/src/lib/unified-search';
import { pushRecentSearch, readRecentSearches } from '@/src/lib/recent-searches';
import { colors } from '@/src/theme/colors';

const FILTERS: { key: UnifiedSearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'markets', label: 'Markets' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'chefs', label: 'Chefs' },
  { key: 'products', label: 'Products' },
];

const EMPTY: UnifiedSearchResults = {
  markets: [],
  vendors: [],
  chefs: [],
  products: [],
  services: [],
  leftovers: [],
};

export default function SearchTabScreen() {
  const { user, shopper } = useAuth();
  const { saved } = useSavedVendors();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UnifiedSearchFilter>('all');
  const [results, setResults] = useState<UnifiedSearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [discover, setDiscover] = useState<DiscoverFeedData | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const { coords } = useUserCoords();

  useEffect(() => {
    void readRecentSearches().then(setRecentSearches);
  }, []);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  const lat = coords?.latitude ?? null;
  const lng = coords?.longitude ?? null;
  const searchCoords = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  useEffect(() => {
    if (active) return;

    let cancelled = false;
    setDiscoverLoading(true);

    void fetchDiscoverFeed({
      coords: searchCoords,
      userCity: user?.city,
      userState: user?.state,
      interests: shopper?.interests ?? [],
      savedVendorIds: saved,
    }).then((feed) => {
      if (!cancelled) {
        setDiscover(feed);
        setDiscoverLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [active, searchCoords, user?.city, user?.state, shopper?.interests, saved]);

  useEffect(() => {
    if (!active) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const handle = setTimeout(async () => {
      const data = await runUnifiedSearch(trimmed, filter, searchCoords);
      if (!cancelled) {
        setResults(data);
        setLoading(false);
        if (unifiedSearchTotal(data) > 0) {
          void pushRecentSearch(trimmed).then(() => readRecentSearches().then(setRecentSearches));
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, filter, active, searchCoords]);

  const total = unifiedSearchTotal(results);

  return (
    <Screen scroll>
      <SearchField
        className="mb-4"
        glass
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Search markets, vendors, chefs, products…"
      />

      {active ? (
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
      ) : null}

      {!active ? (
        <>
          <View className="mb-5">
            <Text variant="heading" className="mb-3">
              Recent searches
            </Text>
            {recentSearches.length === 0 ? (
              <Text variant="caption" style={{ opacity: 0.72 }}>
                Your recent searches will appear here.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => setQuery(term)}
                    className="rounded-full bg-surface px-3 py-2 active:scale-[0.98]"
                    style={{ shadowColor: '#2D2A26', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }}>
                    <Text variant="caption">{term}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <DiscoverBrowseFeed data={discover} loading={discoverLoading} />
        </>
      ) : loading ? (
        <LoadingIndicator />
      ) : total === 0 ? (
        <View className="items-center rounded-bento bg-warm-sage px-6 py-10">
          <FontAwesome name="search" size={26} color={colors.sage} />
          <Text variant="subtitle" className="mt-3 text-center font-semibold">
            No results for &ldquo;{trimmed}&rdquo;
          </Text>
          <Text variant="caption" className="mt-2 text-center">
            Try a different spelling or filter.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          {results.markets.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-2">
                Markets
              </Text>
              {results.markets.map((event) => (
                <Pressable
                  key={event.id}
                  onPress={() => router.push(`/(shopper)/events/${event.id}`)}
                  className="mb-2 rounded-card bg-surface p-4">
                  <Text variant="body" className="font-semibold">
                    {event.name}
                  </Text>
                  <Text variant="caption">
                    {[event.city, event.state].filter(Boolean).join(', ')} ·{' '}
                    {formatEventDate(event.start_datetime)}
                    {formatDistanceKm(event.distance_km)
                      ? ` · ${formatDistanceKm(event.distance_km)}`
                      : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {results.vendors.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-2">
                Vendors
              </Text>
              {results.vendors.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  onPress={() => router.push(`/(shopper)/vendors/${vendor.id}`)}
                />
              ))}
            </View>
          ) : null}

          {results.chefs.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-2">
                Chefs
              </Text>
              {results.chefs.map((chef) => (
                <ChefCard
                  key={chef.id}
                  chef={chef}
                  onPress={() => router.push(`/(shopper)/chefs/${chef.id}`)}
                />
              ))}
            </View>
          ) : null}

          {results.services.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-2">
                Chef services
              </Text>
              {results.services.map((service) => (
                <Pressable
                  key={service.id}
                  onPress={() => router.push(`/(shopper)/chefs/book/${service.id}`)}
                  className="mb-2 rounded-card bg-surface p-4">
                  <Text variant="body" className="font-semibold">
                    {service.service_name}
                  </Text>
                  <Text variant="caption">
                    {service.chef?.display_name ?? 'Chef'} · {formatCents(service.base_price)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {results.products.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-2">
                Products
              </Text>
              {results.products.map((product) => (
                <Pressable
                  key={product.id}
                  onPress={() => router.push(`/(shopper)/products/${product.id}`)}
                  className="mb-2 rounded-card bg-surface p-4">
                  <Text variant="body" className="font-semibold">
                    {product.name}
                  </Text>
                  <Text variant="caption">
                    {product.vendor?.business_name ?? 'Vendor'} · {formatPrice(product.price)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {results.leftovers.length > 0 ? (
            <View>
              <Text variant="heading" className="mb-2">
                Leftovers
              </Text>
              {results.leftovers.map((listing) => (
                <Pressable
                  key={listing.id}
                  onPress={() => router.push(`/(shopper)/leftovers/${listing.id}`)}
                  className="mb-2 rounded-card bg-surface p-4">
                  <Text variant="body" className="font-semibold">
                    {listing.title}
                  </Text>
                  <Text variant="caption">
                    {[
                      listing.vendor_name ?? 'Vendor',
                      listing.price_cents != null ? formatCents(listing.price_cents) : null,
                      formatDistanceKm(listing.distance_km),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
