import { supabase } from '@/src/lib/supabase';
import type { FeedPost } from '@/src/components/feed/post-card';

export type FeedMode = 'saved' | 'explore';
export type ExploreScope = 'local' | 'popular';

const POST_SELECT =
  'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, publish_at, created_at, vendor:vendors(id, business_name, sell_city, sell_state), product:products(id, name), event:events(id, name)';

export interface ShopperLocation {
  city: string | null;
  state: string | null;
}

/** City/state for local explore — falls back to onboarding default_location when city is unset. */
export function resolveShopperLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  defaultLocation: string | null | undefined,
): ShopperLocation {
  let resolvedCity = city?.trim() || null;
  const resolvedState = state?.trim() || null;

  if (!resolvedCity && defaultLocation?.trim()) {
    const loc = defaultLocation.trim();
    if (!/^\d{5}(-\d{4})?$/.test(loc)) {
      resolvedCity = loc;
    }
  }

  return { city: resolvedCity, state: resolvedState };
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function vendorMatchesLocation(
  vendorCity: string | null | undefined,
  vendorState: string | null | undefined,
  city: string | null,
  state: string | null,
): boolean {
  const normalizedCity = normalize(city);
  const normalizedState = normalize(state);
  const vCity = normalize(vendorCity);
  const vState = normalize(vendorState);

  if (!normalizedCity && !normalizedState) return false;
  if (!vCity && !vState) return false;

  if (normalizedState && vState === normalizedState) {
    if (!normalizedCity) return true;
    return vCity === normalizedCity;
  }
  if (normalizedCity && vCity === normalizedCity) {
    return true;
  }
  return false;
}

export async function fetchShopperFeedPosts(): Promise<{
  posts: FeedPost[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .lte('publish_at', new Date().toISOString())
    .order('publish_at', { ascending: false })
    .limit(100);

  if (error) {
    return { posts: [], error: error.message };
  }

  return { posts: (data as unknown as FeedPost[]) ?? [], error: null };
}

export function filterSavedFeedPosts(posts: FeedPost[], savedVendorIds: string[]): FeedPost[] {
  if (savedVendorIds.length === 0) return [];
  const saved = new Set(savedVendorIds);
  return posts.filter((post) => saved.has(post.vendor_id));
}

export function filterLocalFeedPosts(posts: FeedPost[], location: ShopperLocation): FeedPost[] {
  if (!location.city && !location.state) return [];

  return posts.filter((post) => {
    const vendor = post.vendor;
    return vendorMatchesLocation(vendor?.sell_city, vendor?.sell_state, location.city, location.state);
  });
}

/** Nationwide explore — all published posts from approved vendors, newest first. */
export function filterPopularFeedPosts(posts: FeedPost[]): FeedPost[] {
  return posts;
}

export function resolveFeedPosts(
  posts: FeedPost[],
  mode: FeedMode,
  exploreScope: ExploreScope,
  savedVendorIds: string[],
  location: ShopperLocation,
): FeedPost[] {
  if (mode === 'saved') {
    return filterSavedFeedPosts(posts, savedVendorIds);
  }
  if (exploreScope === 'local') {
    return filterLocalFeedPosts(posts, location);
  }
  return filterPopularFeedPosts(posts);
}

export type FeedVisibilityIssue =
  | 'none'
  | 'rls_empty'
  | 'not_saved'
  | 'local_mismatch'
  | 'explore_policy'
  | 'scheduled';

/** Explains why the shopper feed looks empty when posts exist in the system. */
export function diagnoseFeedVisibility(
  allPosts: FeedPost[],
  visiblePosts: FeedPost[],
  mode: FeedMode,
  exploreScope: ExploreScope,
  savedVendorIds: string[],
  location: ShopperLocation,
): FeedVisibilityIssue {
  if (visiblePosts.length > 0) return 'none';
  if (allPosts.length === 0) return 'rls_empty';

  if (mode === 'saved') {
    if (savedVendorIds.length === 0) return 'not_saved';
    if (allPosts.length === 0) return 'rls_empty';
    const savedSet = new Set(savedVendorIds);
    if (!allPosts.some((p) => savedSet.has(p.vendor_id))) return 'not_saved';
    return 'none';
  }

  if (exploreScope === 'local') {
    const localPosts = filterLocalFeedPosts(allPosts, location);
    if (localPosts.length > 0) return 'none';
    return 'local_mismatch';
  }

  return 'explore_policy';
}
