import { dedupeEvents } from '@/lib/dedupe-events';
import type { EventsScope } from '@/lib/events-list';
import type { Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';

/** List/map fields only — avoids multi‑MB description/history payloads. */
export const EVENT_LIST_SELECT =
  'id,name,city,state,address,latitude,longitude,start_datetime,end_datetime,timezone,event_status,visibility_status,market_type,hours_summary,banner_url,website_url,extra_info,sync_metadata';

const LOCAL_RADIUS_MILES = 120;
const MAP_RADIUS_MILES = 200;
const LOCAL_LIST_LIMIT = 200;
const NATIONWIDE_LIST_LIMIT = 200;
const MAP_FALLBACK_LIMIT = 350;

function bboxForRadius(center: Coords, radiusMiles: number) {
  const latDelta = radiusMiles / 69;
  const lngDelta =
    radiusMiles / (69 * Math.max(0.25, Math.cos((center.latitude * Math.PI) / 180)));
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

export interface FetchPublicEventsOptions {
  scope?: EventsScope;
  near?: Coords | null;
  forMap?: boolean;
}

export async function fetchPublicEvents(
  options: FetchPublicEventsOptions = {},
): Promise<{ data: Event[]; error: string | null; truncated: boolean }> {
  const scope = options.scope ?? 'nationwide';
  const forMap = options.forMap ?? false;
  const near = options.near ?? null;

  let query = supabase
    .from('events')
    .select(EVENT_LIST_SELECT)
    .eq('visibility_status', 'public');

  if (forMap) {
    query = query.not('latitude', 'is', null).not('longitude', 'is', null);
  }

  let truncated = false;

  if (near) {
    const box = bboxForRadius(near, forMap ? MAP_RADIUS_MILES : LOCAL_RADIUS_MILES);
    query = query
      .gte('latitude', box.minLat)
      .lte('latitude', box.maxLat)
      .gte('longitude', box.minLng)
      .lte('longitude', box.maxLng);
  } else if (forMap) {
    query = query.limit(MAP_FALLBACK_LIMIT);
    truncated = true;
  } else {
    const limit = scope === 'local' ? LOCAL_LIST_LIMIT : NATIONWIDE_LIST_LIMIT;
    query = query.limit(limit);
    truncated = scope === 'nationwide';
  }

  const { data, error } = await query
    .order('start_datetime', { ascending: true })
    .order('name', { ascending: true });

  return {
    data: dedupeEvents((data ?? []) as Event[]),
    error: error?.message ?? null,
    truncated,
  };
}
