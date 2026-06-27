import type { Coords } from '@/lib/geo';
import { fetchNearbyEvents } from '@/lib/geo-search';
import { supabase } from '@/lib/supabase';

export type UnifiedSearchFilter = 'all' | 'events' | 'vendors' | 'chefs' | 'products';

export interface EventSearchResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  start_datetime: string;
  /** Distance from the user in km when geo-ranked; null otherwise. */
  distance_km?: number | null;
}

export interface VendorSearchResult {
  id: string;
  business_name: string | null;
  category: string | null;
  distance_km?: number | null;
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

function mapSearchAllRows(rows: SearchAllRow[]): Omit<UnifiedSearchResults, 'services'> {
  const events: EventSearchResult[] = [];
  const vendors: VendorSearchResult[] = [];
  const chefs: ChefSearchResult[] = [];
  const products: ProductSearchResult[] = [];
  const leftovers: LeftoverSearchResult[] = [];

  for (const row of rows) {
    switch (row.entity_type) {
      case 'event':
        events.push({
          id: row.entity_id,
          name: row.title ?? '',
          city: row.city,
          state: row.state,
          start_datetime: metaString(row.metadata, 'start_datetime') ?? '',
          distance_km: row.distance_km,
        });
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
    if (error && import.meta.env.DEV) {
      console.warn('[search] search_all RPC failed; using direct Supabase fallback.', error.message);
    }
    return runUnifiedSearchFallback(trimmed, filter, coords);
  }

  const mapped = mapSearchAllRows(data as SearchAllRow[]);
  const services = wantChefs ? await fetchChefServices(trimmed) : [];

  const results = { ...mapped, services };
  const wantEvents = filter === 'all' || filter === 'events';
  if (wantEvents && mapped.events.length === 0) {
    const fallback = await runUnifiedSearchFallback(trimmed, filter, coords);
    if (fallback.events.length > 0) {
      return {
        ...results,
        events: fallback.events,
      };
    }
  }

  return results;
}

/** Legacy client-side path kept as a graceful fallback if the RPC is unavailable. */
async function runUnifiedSearchFallback(
  trimmed: string,
  filter: UnifiedSearchFilter,
  coords?: Coords | null,
): Promise<UnifiedSearchResults> {
  const like = `%${trimmed}%`;
  const wantEvents = filter === 'all' || filter === 'events';
  const wantChefs = filter === 'all' || filter === 'chefs';

  const geoEvents = wantEvents ? await geoRankedEvents(trimmed, coords) : null;

  const [eventsRes, vendorsRes, chefsRes, productsRes, servicesRes] = await Promise.all([
    wantEvents && geoEvents === null
      ? supabase
          .from('events')
          .select('id, name, city, state, start_datetime')
          .eq('visibility_status', 'public')
          .or(`name.ilike.${like},city.ilike.${like},state.ilike.${like}`)
          .order('start_datetime', { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [] }),
    filter === 'all' || filter === 'vendors'
      ? supabase
          .from('vendors')
          .select('id, business_name, category')
          .eq('approval_status', 'approved')
          .ilike('business_name', like)
          .limit(10)
      : Promise.resolve({ data: [] }),
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

  return {
    events: geoEvents ?? (eventsRes.data as EventSearchResult[]) ?? [],
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
  return nearby.map((event) => ({
    id: event.id,
    name: event.name,
    city: event.city,
    state: event.state,
    start_datetime: event.start_datetime,
    distance_km: event.distance_km,
  }));
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
