import type { Coords } from '@/lib/geo';
import { fetchNearbyEvents } from '@/lib/geo-search';
import { EVENT_LIST_SELECT } from '@/lib/events-query';
import { supabase } from '@/lib/supabase';

export type UnifiedSearchFilter = 'all' | 'events' | 'vendors' | 'chefs' | 'products';

export interface EventSearchResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  timezone?: string | null;
  hours_summary?: string | null;
  sync_metadata?: Record<string, unknown>;
  /** Distance from the user in km when geo-ranked; null otherwise. */
  distance_km?: number | null;
}

export interface VendorSearchResult {
  id: string;
  business_name: string | null;
  category: string | null;
  distance_km?: number | null;
  is_catering_provider?: boolean | null;
}

export interface ChefSearchResult {
  id: string;
  display_name: string;
  home_base_city: string | null;
  home_base_state: string | null;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  vendor: { business_name: string | null } | null;
}

export interface ChefServiceSearchResult {
  id: string;
  service_name: string;
  chef_id: string;
  base_price: number;
  chef: { display_name: string } | null;
}

export interface LeftoverSearchResult {
  id: string;
  title: string;
  vendor_name: string | null;
  price_cents: number | null;
  city: string | null;
  state: string | null;
  distance_km?: number | null;
}

export interface UnifiedSearchResults {
  events: EventSearchResult[];
  vendors: VendorSearchResult[];
  chefs: ChefSearchResult[];
  products: ProductSearchResult[];
  services: ChefServiceSearchResult[];
  leftovers: LeftoverSearchResult[];
}

const EMPTY: UnifiedSearchResults = {
  events: [],
  vendors: [],
  chefs: [],
  products: [],
  services: [],
  leftovers: [],
};

const KM_PER_MILE = 1.609344;

const EVENT_SCHEDULE_ENRICH_SELECT =
  'id, end_datetime, timezone, hours_summary, sync_metadata, state';

/** Distance in km (from `search_all`) → human "X mi away" label, or null. */
export function formatDistanceKm(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  const miles = distanceKm / KM_PER_MILE;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

interface SearchAllRow {
  entity_type: 'vendor' | 'chef' | 'event' | 'product' | 'leftover';
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  rank: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

function entityTypesForFilter(filter: UnifiedSearchFilter): string[] | null {
  switch (filter) {
    case 'events':
      return ['event'];
    case 'vendors':
      return ['vendor'];
    case 'chefs':
      return ['chef'];
    case 'products':
      return ['product'];
    default:
      return null;
  }
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' ? value : null;
}

function metaNumber(meta: Record<string, unknown> | null, key: string): number | null {
  const value = meta?.[key];
  return typeof value === 'number' ? value : null;
}

function metaObject(meta: Record<string, unknown> | null, key: string): Record<string, unknown> | undefined {
  const value = meta?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mapEventSearchRow(
  id: string,
  name: string,
  city: string | null,
  state: string | null,
  metadata: Record<string, unknown> | null,
  distanceKm: number | null,
): EventSearchResult {
  return {
    id,
    name,
    city,
    state,
    start_datetime: metaString(metadata, 'start_datetime') ?? '',
    end_datetime: metaString(metadata, 'end_datetime'),
    timezone: metaString(metadata, 'timezone'),
    hours_summary: metaString(metadata, 'hours_summary'),
    sync_metadata: metaObject(metadata, 'sync_metadata'),
    distance_km: distanceKm,
  };
}

function mapSearchAllRows(rows: SearchAllRow[]): Omit<UnifiedSearchResults, 'services'> {
  const events: EventSearchResult[] = [];
  const vendors: VendorSearchResult[] = [];
  const chefs: ChefSearchResult[] = [];
  const products: ProductSearchResult[] = [];
  const leftovers: LeftoverSearchResult[] = [];

  for (const row of rows) {
    switch (row.entity_type) {
      case 'event':
        events.push(
          mapEventSearchRow(
            row.entity_id,
            row.title ?? '',
            row.city,
            row.state,
            row.metadata,
            row.distance_km,
          ),
        );
        break;
      case 'vendor':
        vendors.push({
          id: row.entity_id,
          business_name: row.title,
          category: metaString(row.metadata, 'category'),
          distance_km: row.distance_km,
        });
        break;
      case 'chef':
        chefs.push({
          id: row.entity_id,
          display_name: row.title ?? '',
          home_base_city: row.city,
          home_base_state: row.state,
        });
        break;
      case 'product':
        products.push({
          id: row.entity_id,
          name: row.title ?? '',
          price: metaNumber(row.metadata, 'price') ?? 0,
          vendor: { business_name: metaString(row.metadata, 'vendor_name') },
        });
        break;
      case 'leftover':
        leftovers.push({
          id: row.entity_id,
          title: row.title ?? '',
          vendor_name: metaString(row.metadata, 'vendor_name'),
          price_cents: metaNumber(row.metadata, 'price_cents'),
          city: row.city,
          state: row.state,
          distance_km: row.distance_km,
        });
        break;
    }
  }

  return { events, vendors, chefs, products, leftovers };
}

/** Fills schedule fields when geo RPC rows omit hours_summary / sync_metadata. */
async function enrichEventScheduleFields(events: EventSearchResult[]): Promise<EventSearchResult[]> {
  const needsEnrich = events.filter((event) => !event.hours_summary && !event.sync_metadata);
  if (needsEnrich.length === 0) return events;

  const { data } = await supabase
    .from('events')
    .select(EVENT_SCHEDULE_ENRICH_SELECT)
    .in(
      'id',
      needsEnrich.map((event) => event.id),
    );

  if (!data?.length) return events;

  const byId = new Map(
    (data as {
      id: string;
      end_datetime: string | null;
      timezone: string | null;
      hours_summary: string | null;
      sync_metadata: Record<string, unknown> | null;
      state: string | null;
    }[]).map((row) => [row.id, row]),
  );

  return events.map((event) => {
    const extra = byId.get(event.id);
    if (!extra) return event;
    return {
      ...event,
      end_datetime: event.end_datetime ?? extra.end_datetime,
      timezone: event.timezone ?? extra.timezone,
      hours_summary: event.hours_summary ?? extra.hours_summary,
      sync_metadata: event.sync_metadata ?? extra.sync_metadata ?? undefined,
      state: event.state ?? extra.state,
    };
  });
}

async function fetchChefServices(query: string): Promise<ChefServiceSearchResult[]> {
  const { data } = await supabase
    .from('chef_services')
    .select('id, service_name, chef_id, base_price, chef:chefs(display_name)')
    .eq('active', true)
    .ilike('service_name', `%${query}%`)
    .limit(10);
  return (data as unknown as ChefServiceSearchResult[]) ?? [];
}

/**
 * Server-side unified search via the `search_all` RPC (phase28_search_index).
 * Falls back to the legacy client-side per-vertical merge when the RPC errors.
 */
export async function runUnifiedSearch(
  query: string,
  filter: UnifiedSearchFilter,
  coords?: Coords | null,
  options?: { cateringOnly?: boolean },
): Promise<UnifiedSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return EMPTY;

  const wantChefs = filter === 'all' || filter === 'chefs';
  const cateringOnly = Boolean(options?.cateringOnly);

  const { data, error } = await supabase.rpc('search_all', {
    p_query: trimmed,
    p_lat: coords?.latitude ?? null,
    p_lng: coords?.longitude ?? null,
    p_limit: 50,
    p_entity_types: entityTypesForFilter(filter),
  });

  if (error || data == null) {
    if (error && import.meta.env.DEV) {
      console.warn('[search] search_all RPC failed; using direct Supabase fallback.', error.message);
    }
    return runUnifiedSearchFallback(trimmed, filter, coords, cateringOnly);
  }

  const mapped = mapSearchAllRows(data as SearchAllRow[]);
  const services = wantChefs ? await fetchChefServices(trimmed) : [];

  let vendors = mapped.vendors;
  if (cateringOnly) {
    vendors = await filterVendorsByCatering(vendors);
  }

  const results = {
    ...mapped,
    vendors,
    events: await enrichEventScheduleFields(mapped.events),
    services,
  };
  const wantEvents = filter === 'all' || filter === 'events';
  if (wantEvents && mapped.events.length === 0) {
    const fallback = await runUnifiedSearchFallback(trimmed, filter, coords, cateringOnly);
    if (fallback.events.length > 0) {
      return {
        ...results,
        events: fallback.events,
      };
    }
  }

  return results;
}

async function filterVendorsByCatering(
  vendors: VendorSearchResult[],
): Promise<VendorSearchResult[]> {
  if (vendors.length === 0) return [];
  const ids = vendors.map((v) => v.id);
  const { data } = await supabase
    .from('vendors')
    .select('id, is_catering_provider')
    .in('id', ids)
    .eq('is_catering_provider', true);
  const allowed = new Set((data ?? []).map((row) => String(row.id)));
  return vendors
    .filter((v) => allowed.has(v.id))
    .map((v) => ({ ...v, is_catering_provider: true }));
}

/** Legacy client-side path kept as a graceful fallback if the RPC is unavailable. */
async function runUnifiedSearchFallback(
  trimmed: string,
  filter: UnifiedSearchFilter,
  coords?: Coords | null,
  cateringOnly = false,
): Promise<UnifiedSearchResults> {
  const like = `%${trimmed}%`;
  const wantEvents = filter === 'all' || filter === 'events';
  const wantChefs = filter === 'all' || filter === 'chefs';

  const geoEvents = wantEvents ? await geoRankedEvents(trimmed, coords) : null;

  const vendorsQuery =
    filter === 'all' || filter === 'vendors'
      ? (() => {
          let q = supabase
            .from('vendors')
            .select('id, business_name, category, is_catering_provider')
            .eq('approval_status', 'approved')
            .ilike('business_name', like)
            .limit(20);
          if (cateringOnly) q = q.eq('is_catering_provider', true);
          return q;
        })()
      : Promise.resolve({ data: [] });

  const [eventsRes, vendorsRes, chefsRes, productsRes, servicesRes] = await Promise.all([
    wantEvents && geoEvents === null
      ? supabase
          .from('events')
          .select(EVENT_LIST_SELECT)
          .eq('visibility_status', 'public')
          .or(`name.ilike.${like},city.ilike.${like},state.ilike.${like}`)
          .order('start_datetime', { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [] }),
    vendorsQuery,
    wantChefs
      ? supabase
          .from('chefs')
          .select('id, display_name, home_base_city, home_base_state')
          .eq('approval_status', 'approved')
          .ilike('display_name', like)
          .limit(10)
      : Promise.resolve({ data: [] }),
    filter === 'all' || filter === 'products'
      ? supabase
          .from('products')
          .select('id, name, price, vendor:vendors(business_name)')
          .eq('status', 'active')
          .ilike('name', like)
          .limit(10)
      : Promise.resolve({ data: [] }),
    wantChefs
      ? supabase
          .from('chef_services')
          .select('id, service_name, chef_id, base_price, chef:chefs(display_name)')
          .eq('active', true)
          .ilike('service_name', like)
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const fallbackEvents =
    geoEvents ??
    ((eventsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      city: (row.city as string | null) ?? null,
      state: (row.state as string | null) ?? null,
      start_datetime: String(row.start_datetime ?? ''),
      end_datetime: (row.end_datetime as string | null) ?? null,
      timezone: (row.timezone as string | null) ?? null,
      hours_summary: (row.hours_summary as string | null) ?? null,
      sync_metadata: (row.sync_metadata as Record<string, unknown> | undefined) ?? undefined,
    }));

  return {
    events: await enrichEventScheduleFields(fallbackEvents),
    vendors: (vendorsRes.data as VendorSearchResult[]) ?? [],
    chefs: (chefsRes.data as ChefSearchResult[]) ?? [],
    products: (productsRes.data as unknown as ProductSearchResult[]) ?? [],
    services: (servicesRes.data as unknown as ChefServiceSearchResult[]) ?? [],
    leftovers: [],
  };
}

async function geoRankedEvents(
  query: string,
  coords: Coords | null | undefined,
): Promise<EventSearchResult[] | null> {
  const nearby = await fetchNearbyEvents(coords, { search: query, limit: 30 });
  if (!nearby) return null;
  const events = nearby.map((event) => ({
    id: event.id,
    name: event.name,
    city: event.city,
    state: event.state,
    start_datetime: event.start_datetime,
    end_datetime: event.end_datetime,
    distance_km: event.distance_km,
  }));
  return enrichEventScheduleFields(events);
}

export function unifiedSearchTotal(results: UnifiedSearchResults): number {
  return (
    results.events.length +
    results.vendors.length +
    results.chefs.length +
    results.products.length +
    results.services.length +
    results.leftovers.length
  );
}
