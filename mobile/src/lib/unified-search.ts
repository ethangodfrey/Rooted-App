import type { Coords } from '@/src/lib/geo';
import { fetchNearbyEvents } from '@/src/lib/geo-search';
import { EVENT_LIST_SELECT } from '@/src/lib/events-query';
import { supabase } from '@/src/lib/supabase';

export type UnifiedSearchFilter = 'all' | 'markets' | 'vendors' | 'chefs' | 'products';

export interface MarketSearchResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  timezone?: string | null;
  hours_summary?: string | null;
  sync_metadata?: Record<string, unknown>;
  /** Distance from the user in km when geo-ranked; null for the text fallback. */
  distance_km?: number | null;
}

export interface VendorSearchResult {
  id: string;
  business_name: string | null;
  category: string | null;
  vendor_type: string | null;
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
  vendor_id: string;
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
  /** Distance from the user in km when geo-ranked; null otherwise. */
  distance_km?: number | null;
}

export interface UnifiedSearchResults {
  markets: MarketSearchResult[];
  vendors: VendorSearchResult[];
  chefs: ChefSearchResult[];
  products: ProductSearchResult[];
  services: ChefServiceSearchResult[];
  leftovers: LeftoverSearchResult[];
}

const EMPTY: UnifiedSearchResults = {
  markets: [],
  vendors: [],
  chefs: [],
  products: [],
  services: [],
  leftovers: [],
};

const EVENT_SCHEDULE_ENRICH_SELECT =
  'id, end_datetime, timezone, hours_summary, sync_metadata, state';

/**
 * Row shape returned by the `search_all` RPC (phase28_search_index.sql). The
 * unified `search_index` materialized view ranks vendors / chefs / events /
 * products together by full-text relevance + geo distance.
 */
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

/** Maps a UI filter to the RPC `p_entity_types` array (null = all verticals). */
function entityTypesForFilter(filter: UnifiedSearchFilter): string[] | null {
  switch (filter) {
    case 'markets':
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

function mapMarketSearchRow(
  id: string,
  name: string,
  city: string | null,
  state: string | null,
  metadata: Record<string, unknown> | null,
  distanceKm: number | null,
): MarketSearchResult {
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

/** Maps ranked `search_all` rows into the per-vertical result buckets. */
function mapSearchAllRows(rows: SearchAllRow[]): Omit<UnifiedSearchResults, 'services'> {
  const markets: MarketSearchResult[] = [];
  const vendors: VendorSearchResult[] = [];
  const chefs: ChefSearchResult[] = [];
  const products: ProductSearchResult[] = [];
  const leftovers: LeftoverSearchResult[] = [];

  for (const row of rows) {
    switch (row.entity_type) {
      case 'event':
        markets.push(
          mapMarketSearchRow(
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
          vendor_type: metaString(row.metadata, 'vendor_type'),
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
          vendor_id: metaString(row.metadata, 'vendor_id') ?? '',
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

  return { markets, vendors, chefs, products, leftovers };
}

/** Fills schedule fields when geo RPC rows omit hours_summary / sync_metadata. */
async function enrichMarketScheduleFields(markets: MarketSearchResult[]): Promise<MarketSearchResult[]> {
  const needsEnrich = markets.filter((market) => !market.hours_summary && !market.sync_metadata);
  if (needsEnrich.length === 0) return markets;

  const { data } = await supabase
    .from('events')
    .select(EVENT_SCHEDULE_ENRICH_SELECT)
    .in(
      'id',
      needsEnrich.map((market) => market.id),
    );

  if (!data?.length) return markets;

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

  return markets.map((market) => {
    const extra = byId.get(market.id);
    if (!extra) return market;
    return {
      ...market,
      end_datetime: market.end_datetime ?? extra.end_datetime,
      timezone: market.timezone ?? extra.timezone,
      hours_summary: market.hours_summary ?? extra.hours_summary,
      sync_metadata: market.sync_metadata ?? extra.sync_metadata ?? undefined,
      state: market.state ?? extra.state,
    };
  });
}

/**
 * Chef services are not part of the unified `search_index` (the index covers
 * vendor/chef/event/product). They are fetched separately so the search UI can
 * still surface bookable services when chefs are in scope.
 */
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
 * Server-side unified search via the `search_all` RPC. Falls back to the legacy
 * client-side per-vertical merge when the RPC errors (mirrors how the geo RPCs
 * degrade when unavailable).
 */
export async function runUnifiedSearch(
  query: string,
  filter: UnifiedSearchFilter,
  coords?: Coords | null,
): Promise<UnifiedSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return EMPTY;

  const wantChefs = filter === 'all' || filter === 'chefs';

  const { data, error } = await supabase.rpc('search_all', {
    p_query: trimmed,
    p_lat: coords?.latitude ?? null,
    p_lng: coords?.longitude ?? null,
    p_limit: 50,
    p_entity_types: entityTypesForFilter(filter),
  });

  if (error || data == null) {
    if (error && __DEV__) {
      console.warn('[search] search_all RPC failed; using direct Supabase fallback.', error.message);
    }
    return runUnifiedSearchFallback(trimmed, filter, coords);
  }

  const mapped = mapSearchAllRows(data as SearchAllRow[]);
  const services = wantChefs ? await fetchChefServices(trimmed) : [];

  const results = {
    ...mapped,
    markets: await enrichMarketScheduleFields(mapped.markets),
    services,
  };
  const wantMarkets = filter === 'all' || filter === 'markets';
  if (wantMarkets && mapped.markets.length === 0) {
    const fallback = await runUnifiedSearchFallback(trimmed, filter, coords);
    if (fallback.markets.length > 0) {
      return {
        ...results,
        markets: fallback.markets,
      };
    }
  }

  return results;
}

/**
 * Legacy client-side path: separate queries per vertical merged in JS. Kept as
 * a graceful fallback if the `search_all` RPC is unavailable.
 */
async function runUnifiedSearchFallback(
  trimmed: string,
  filter: UnifiedSearchFilter,
  coords?: Coords | null,
): Promise<UnifiedSearchResults> {
  const like = `%${trimmed}%`;
  const wantMarkets = filter === 'all' || filter === 'markets';
  const wantVendors = filter === 'all' || filter === 'vendors';
  const wantChefs = filter === 'all' || filter === 'chefs';
  const wantProducts = filter === 'all' || filter === 'products';

  const geoMarkets = wantMarkets ? await geoRankedMarkets(trimmed, coords) : null;

  const [marketsRes, vendorsRes, chefsRes, productsRes, servicesRes] = await Promise.all([
    wantMarkets && geoMarkets === null
      ? supabase
          .from('events')
          .select(EVENT_LIST_SELECT)
          .eq('visibility_status', 'public')
          .or(`name.ilike.${like},city.ilike.${like},state.ilike.${like}`)
          .order('start_datetime', { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [] as MarketSearchResult[] }),
    wantVendors
      ? supabase
          .from('vendors')
          .select('id, business_name, category, vendor_type')
          .eq('approval_status', 'approved')
          .ilike('business_name', like)
          .limit(10)
      : Promise.resolve({ data: [] as VendorSearchResult[] }),
    wantChefs
      ? supabase
          .from('chefs')
          .select('id, display_name, home_base_city, home_base_state')
          .eq('approval_status', 'approved')
          .ilike('display_name', like)
          .limit(10)
      : Promise.resolve({ data: [] as ChefSearchResult[] }),
    wantProducts
      ? supabase
          .from('products')
          .select('id, name, price, vendor_id, vendor:vendors(business_name)')
          .eq('status', 'active')
          .ilike('name', like)
          .limit(10)
      : Promise.resolve({ data: [] as ProductSearchResult[] }),
    wantChefs
      ? supabase
          .from('chef_services')
          .select('id, service_name, chef_id, base_price, chef:chefs(display_name)')
          .eq('active', true)
          .ilike('service_name', like)
          .limit(10)
      : Promise.resolve({ data: [] as ChefServiceSearchResult[] }),
  ]);

  const fallbackMarkets =
    geoMarkets ??
    ((marketsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
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
    markets: await enrichMarketScheduleFields(fallbackMarkets),
    vendors: (vendorsRes.data as VendorSearchResult[]) ?? [],
    chefs: (chefsRes.data as ChefSearchResult[]) ?? [],
    products: (productsRes.data as unknown as ProductSearchResult[]) ?? [],
    services: (servicesRes.data as unknown as ChefServiceSearchResult[]) ?? [],
    leftovers: [],
  };
}

/**
 * Geo-ranked markets via the PostGIS `find_nearby_events` RPC. Returns `null`
 * when coords are missing or the RPC errors so callers fall back to text order.
 */
async function geoRankedMarkets(
  query: string,
  coords: Coords | null | undefined,
): Promise<MarketSearchResult[] | null> {
  const nearby = await fetchNearbyEvents(coords, { search: query, limit: 30 });
  if (!nearby) return null;
  const markets = nearby.map((event) => ({
    id: event.id,
    name: event.name,
    city: event.city,
    state: event.state,
    start_datetime: event.start_datetime,
    end_datetime: event.end_datetime,
    distance_km: event.distance_km,
  }));
  return enrichMarketScheduleFields(markets);
}

export function unifiedSearchTotal(results: UnifiedSearchResults): number {
  return (
    results.markets.length +
    results.vendors.length +
    results.chefs.length +
    results.products.length +
    results.services.length +
    results.leftovers.length
  );
}
