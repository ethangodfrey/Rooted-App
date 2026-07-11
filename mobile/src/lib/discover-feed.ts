import type { FeedPost } from '@/src/components/feed/post-card';
import type { Coords } from '@/src/lib/geo';
import { fetchFeaturedPublicMarkets } from '@/src/lib/events-query';
import {
  fetchNearbyEvents,
  fetchNearbyVendors,
  type NearbyEvent,
  type NearbyVendor,
} from '@/src/lib/geo-search';
import { fetchCuratedLeftovers, type CuratedLeftover } from '@/src/lib/leftovers';
import {
  fetchShopperFeedPosts,
  filterSavedFeedPosts,
} from '@/src/lib/shopper-feed';
import {
  fetchPopularProducts,
  fetchSuggestedProducts,
  type PopularProduct,
  type SuggestedProduct,
} from '@/src/lib/suggested-products';
import { supabase } from '@/src/lib/supabase';

export interface DiscoverChef {
  id: string;
  display_name: string;
  home_base_city: string | null;
  home_base_state: string | null;
  featured: boolean;
  profile_photo_url: string | null;
}

export interface DiscoverFeedContext {
  coords?: Coords | null;
  userCity?: string | null;
  userState?: string | null;
  interests?: string[];
  savedVendorIds?: string[];
}

export type DiscoverPostsFocus = 'saved' | 'fresh';

export interface DiscoverFeedData {
  posts: FeedPost[];
  postsFocus: DiscoverPostsFocus;
  markets: NearbyEvent[];
  vendors: NearbyVendor[];
  chefs: DiscoverChef[];
  products: Array<PopularProduct | SuggestedProduct>;
  leftovers: CuratedLeftover[];
}

function resolveDiscoverPosts(
  allPosts: FeedPost[],
  savedVendorIds: string[],
  limit: number,
): { posts: FeedPost[]; postsFocus: DiscoverPostsFocus } {
  if (savedVendorIds.length > 0) {
    const saved = filterSavedFeedPosts(allPosts, savedVendorIds);
    if (saved.length > 0) {
      return { posts: saved.slice(0, limit), postsFocus: 'saved' };
    }
  }
  return { posts: allPosts.slice(0, limit), postsFocus: 'fresh' };
}

async function fetchFeaturedChefs(limit = 8): Promise<DiscoverChef[]> {
  const { data, error } = await supabase
    .from('chefs')
    .select('id, display_name, home_base_city, home_base_state, featured, profile_photo_url')
    .eq('approval_status', 'approved')
    .order('featured', { ascending: false })
    .order('display_name', { ascending: true })
    .limit(limit);

  if (error) return [];
  return (data as DiscoverChef[]) ?? [];
}

async function fetchFeaturedVendorsFallback(limit = 8): Promise<NearbyVendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, business_name, category, vendor_type, sell_city, sell_state, latitude, longitude')
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return ((data ?? []) as Omit<NearbyVendor, 'distance_km'>[]).map((row) => ({
    ...row,
    distance_km: 0,
  }));
}

async function fetchDiscoverProducts(
  context: DiscoverFeedContext,
  limit = 8,
): Promise<Array<PopularProduct | SuggestedProduct>> {
  const location = { userCity: context.userCity, userState: context.userState };
  const interests = context.interests ?? [];

  if (interests.length > 0) {
    const suggested = await fetchSuggestedProducts(interests, location, limit);
    if (suggested.length > 0) return suggested;
  }

  return fetchPopularProducts(location, limit);
}

function eventToNearbyEvent(event: {
  id: string;
  name: string;
  banner_url: string | null;
  start_datetime: string;
  end_datetime: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  event_status: string;
}): NearbyEvent {
  return {
    id: event.id,
    name: event.name,
    description: null,
    banner_url: event.banner_url,
    start_datetime: event.start_datetime,
    end_datetime: event.end_datetime,
    address: event.address,
    city: event.city,
    state: event.state,
    latitude: event.latitude ?? 0,
    longitude: event.longitude ?? 0,
    event_status: event.event_status,
    distance_km: 0,
  };
}

async function fetchDiscoverMarkets(
  context: DiscoverFeedContext,
  limit: number,
): Promise<NearbyEvent[]> {
  if (context.coords) {
    const nearby = await fetchNearbyEvents(context.coords, { limit });
    if (nearby && nearby.length > 0) return nearby;
  }

  const featured = await fetchFeaturedPublicMarkets(limit, { userState: context.userState });
  return featured.map(eventToNearbyEvent);
}

/** Browse feed for the Discover tab — reuses home/search Supabase loaders. */
export async function fetchDiscoverFeed(
  context: DiscoverFeedContext = {},
  limits = { posts: 6, markets: 10, vendors: 8, chefs: 8, products: 10, leftovers: 6 },
): Promise<DiscoverFeedData> {
  const location = {
    coords: context.coords ?? null,
    userCity: context.userCity,
    userState: context.userState,
  };
  const savedVendorIds = context.savedVendorIds ?? [];

  const [postsRes, marketsRes, vendorsRes, chefsRes, productsRes, leftoversRes] =
    await Promise.allSettled([
      fetchShopperFeedPosts(),
      fetchDiscoverMarkets(context, limits.markets),
      context.coords
        ? fetchNearbyVendors(context.coords, { limit: limits.vendors })
        : fetchFeaturedVendorsFallback(limits.vendors),
      fetchFeaturedChefs(limits.chefs),
      fetchDiscoverProducts(context, limits.products),
      fetchCuratedLeftovers(location, limits.leftovers),
    ]);

  const allPosts =
    postsRes.status === 'fulfilled' ? postsRes.value.posts : [];
  const { posts, postsFocus } = resolveDiscoverPosts(allPosts, savedVendorIds, limits.posts);
  const markets =
    marketsRes.status === 'fulfilled' && marketsRes.value ? marketsRes.value : [];
  const vendors =
    vendorsRes.status === 'fulfilled' && vendorsRes.value ? vendorsRes.value : [];
  const chefs = chefsRes.status === 'fulfilled' ? chefsRes.value : [];
  const products = productsRes.status === 'fulfilled' ? productsRes.value : [];
  const leftovers = leftoversRes.status === 'fulfilled' ? leftoversRes.value : [];

  return { posts, postsFocus, markets, vendors, chefs, products, leftovers };
}
