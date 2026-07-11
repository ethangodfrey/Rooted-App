import type { Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

export interface RankedVendorFeedItem {
  id: string;
  vendor_id: string;
  post_type: string;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  video_thumbnail_url: string | null;
  publish_at: string;
  created_at: string;
  business_name: string | null;
  category: string | null;
  sell_city: string | null;
  sell_state: string | null;
  event_id: string | null;
  event_name: string | null;
  distance_miles: number | null;
  score: number;
  priority_flags: string[];
}

export async function fetchRankedVendorFeed(
  coords?: Coords | null,
  limit = 40,
): Promise<RankedVendorFeedItem[]> {
  const { data, error } = await supabase.rpc('get_ranked_vendor_feed', {
    p_lat: coords?.latitude ?? null,
    p_lng: coords?.longitude ?? null,
    p_limit: limit,
  });

  if (error || !data) return [];
  return (data as RankedVendorFeedItem[]) ?? [];
}
