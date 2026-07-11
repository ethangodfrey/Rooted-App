import { vendorPath } from '@/lib/market-routes';
import { supabase } from '@/lib/supabase';
import type { ExploreContentType } from '@/types/database';

/** Default search radius (miles), clamped server-side to 15–50. */
export const EXPLORE_FEED_DEFAULT_RADIUS_MILES = 25;

export const EXPLORE_FEED_MIN_RADIUS_MILES = 15;
export const EXPLORE_FEED_MAX_RADIUS_MILES = 50;

/** Hybrid ranking weights — must match `explore_hybrid_feed` RPC defaults. */
export const EXPLORE_LIKES_WEIGHT = 1.0;
export const EXPLORE_DISTANCE_WEIGHT = 2.0;

export type ExploreHybridItemType = 'vendor_post' | 'showcase';

export interface ExploreHybridFeedItem {
  item_type: ExploreHybridItemType;
  item_id: string;
  creator_type: 'vendor' | 'chef';
  vendor_id: string | null;
  chef_id: string | null;
  creator_name: string | null;
  creator_avatar_url: string | null;
  sell_city: string | null;
  sell_state: string | null;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  media_urls: string[];
  content_kind: string;
  media_type: string | null;
  video_thumbnail_url: string | null;
  total_likes: number;
  distance_miles: number;
  hybrid_score: number;
  created_at: string;
}

/** Raw RPC row includes pagination token on the last item only. */
interface ExploreHybridFeedRpcRow extends ExploreHybridFeedItem {
  next_cursor: string | null;
}

export interface ExploreHybridFeedPage {
  items: ExploreHybridFeedItem[];
  nextCursor: string | null;
}

export interface FetchExploreHybridFeedParams {
  lat: number;
  lng: number;
  radiusMiles?: number;
  likesWeight?: number;
  distanceWeight?: number;
  limit?: number;
  cursor?: string | null;
}

function clampRadius(miles: number | undefined): number {
  const value = miles ?? EXPLORE_FEED_DEFAULT_RADIUS_MILES;
  return Math.min(EXPLORE_FEED_MAX_RADIUS_MILES, Math.max(EXPLORE_FEED_MIN_RADIUS_MILES, value));
}

function normalizeRow(raw: Record<string, unknown>): ExploreHybridFeedRpcRow {
  return {
    item_type: raw.item_type as ExploreHybridItemType,
    item_id: String(raw.item_id),
    creator_type: raw.creator_type as 'vendor' | 'chef',
    vendor_id: (raw.vendor_id as string | null) ?? null,
    chef_id: (raw.chef_id as string | null) ?? null,
    creator_name: (raw.creator_name as string | null) ?? null,
    creator_avatar_url: (raw.creator_avatar_url as string | null) ?? null,
    sell_city: (raw.sell_city as string | null) ?? null,
    sell_state: (raw.sell_state as string | null) ?? null,
    title: (raw.title as string | null) ?? null,
    caption: (raw.caption as string | null) ?? null,
    media_url: (raw.media_url as string | null) ?? null,
    media_urls: Array.isArray(raw.media_urls) ? (raw.media_urls as string[]) : [],
    content_kind: String(raw.content_kind ?? ''),
    media_type: (raw.media_type as string | null) ?? null,
    video_thumbnail_url: (raw.video_thumbnail_url as string | null) ?? null,
    total_likes: Number(raw.total_likes ?? 0),
    distance_miles: Number(raw.distance_miles ?? 0),
    hybrid_score: Number(raw.hybrid_score ?? 0),
    created_at: String(raw.created_at ?? ''),
    next_cursor: (raw.next_cursor as string | null) ?? null,
  };
}

/**
 * Fetch a page of the hybrid explore feed via Supabase RPC.
 * Falls back to chronological showcase-only feed when RPC is unavailable.
 */
export async function fetchExploreHybridFeed(
  params: FetchExploreHybridFeedParams,
): Promise<ExploreHybridFeedPage> {
  const limit = Math.min(params.limit ?? 20, 50);

  const { data, error } = await supabase.rpc('explore_hybrid_feed', {
    p_lat: params.lat,
    p_lng: params.lng,
    p_radius_miles: clampRadius(params.radiusMiles),
    p_likes_weight: params.likesWeight ?? EXPLORE_LIKES_WEIGHT,
    p_distance_weight: params.distanceWeight ?? EXPLORE_DISTANCE_WEIGHT,
    p_limit: limit,
    p_cursor: params.cursor ?? null,
  });

  if (error) {
    return fetchExploreHybridFeedFallback(limit);
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
  const nextCursor =
    rows.map((row) => row.next_cursor).find((token) => Boolean(token)) ?? null;

  return {
    items: rows.map(({ next_cursor: _ignored, ...item }) => item),
    nextCursor,
  };
}

/** Graceful degradation when phase33 SQL has not been applied yet. */
async function fetchExploreHybridFeedFallback(limit: number): Promise<ExploreHybridFeedPage> {
  const { data } = await supabase
    .from('explore_content')
    .select('*')
    .order('engagement_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  const items: ExploreHybridFeedItem[] = (data ?? []).map((row) => ({
    item_type: 'showcase',
    item_id: row.id,
    creator_type: row.creator_type,
    vendor_id: row.vendor_id,
    chef_id: row.chef_id,
    creator_name: null,
    creator_avatar_url: null,
    sell_city: null,
    sell_state: null,
    title: row.title,
    caption: row.caption,
    media_url: row.media_urls?.[0] ?? null,
    media_urls: row.media_urls ?? [],
    content_kind: row.content_type as ExploreContentType,
    media_type: 'image',
    video_thumbnail_url: null,
    total_likes: row.engagement_count ?? 0,
    distance_miles: 0,
    hybrid_score: row.engagement_count ?? 0,
    created_at: row.created_at,
    next_cursor: null,
  }));

  return { items, nextCursor: null };
}

/** Customer destination for a hybrid feed card. */
export function resolveExploreHybridHref(item: ExploreHybridFeedItem): string | null {
  if (item.creator_type === 'vendor' && item.vendor_id) {
    return vendorPath(item.vendor_id);
  }
  if (item.creator_type === 'chef' && item.chef_id) {
    return `/shopper/chefs/${item.chef_id}`;
  }
  return null;
}

export function formatExploreDistanceMiles(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  if (miles < 0.1) return 'Nearby';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
