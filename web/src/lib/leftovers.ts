import type { Coords } from '@/lib/geo';
import { distanceMiles } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

export type LeftoverStatus = 'active' | 'sold_out' | 'expired' | 'cancelled';

export interface LeftoverListing {
  id: string;
  vendor_id: string;
  product_id: string | null;
  source_event_id: string | null;
  title: string;
  description: string | null;
  media_url: string | null;
  price_cents: number;
  quantity_total: number;
  quantity_remaining: number;
  available_from: string;
  expires_at: string;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_notes: string | null;
  status: LeftoverStatus;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    business_name: string | null;
    category?: string | null;
    sell_city?: string | null;
    sell_state?: string | null;
  } | null;
  source_event?: { id: string; name: string } | null;
}

export interface CuratedLeftover extends LeftoverListing {
  hoursLeft: number;
  distanceMiles: number | null;
  locationLabel: string;
}

export interface LeftoverCurationContext {
  coords?: Coords | null;
  userCity?: string | null;
  userState?: string | null;
}

const LISTING_SELECT =
  'id, vendor_id, product_id, source_event_id, title, description, media_url, price_cents, quantity_total, quantity_remaining, available_from, expires_at, pickup_address, pickup_city, pickup_state, pickup_latitude, pickup_longitude, pickup_notes, status, created_at, updated_at, vendor:vendors(id, business_name, category, sell_city, sell_state), source_event:events(id, name)';

function normalizeState(state: string | null | undefined): string | null {
  return state?.trim().toUpperCase() ?? null;
}

function normalizeCity(city: string | null | undefined): string | null {
  return city?.trim().toLowerCase() ?? null;
}

function locationLabel(listing: LeftoverListing): string {
  if (listing.pickup_address?.trim()) return listing.pickup_address.trim();
  if (listing.pickup_city && listing.pickup_state) {
    return `${listing.pickup_city}, ${listing.pickup_state}`;
  }
  if (listing.vendor?.sell_city && listing.vendor?.sell_state) {
    return `${listing.vendor.sell_city}, ${listing.vendor.sell_state}`;
  }
  return 'Pickup nearby';
}

function listingCoords(listing: LeftoverListing): Coords | null {
  if (listing.pickup_latitude != null && listing.pickup_longitude != null) {
    return {
      latitude: Number(listing.pickup_latitude),
      longitude: Number(listing.pickup_longitude),
    };
  }
  return null;
}

export function curateLeftovers(
  listings: LeftoverListing[],
  context: LeftoverCurationContext = {},
): CuratedLeftover[] {
  const now = Date.now();
  const userCity = normalizeCity(context.userCity);
  const userState = normalizeState(context.userState);

  return listings
    .filter((listing) => {
      const expires = new Date(listing.expires_at).getTime();
      const available = new Date(listing.available_from).getTime();
      return (
        listing.status === 'active' &&
        listing.quantity_remaining > 0 &&
        expires > now &&
        available <= now
      );
    })
    .map((listing) => {
      const coords = listingCoords(listing);
      const dist =
        context.coords && coords ? distanceMiles(context.coords, coords) : null;
      const hoursLeft = Math.max(
        0,
        (new Date(listing.expires_at).getTime() - now) / (1000 * 60 * 60),
      );

      const listingCity = normalizeCity(listing.pickup_city ?? listing.vendor?.sell_city);
      const listingState = normalizeState(listing.pickup_state ?? listing.vendor?.sell_state);
      const sameCity = Boolean(userCity && listingCity && userCity === listingCity);
      const sameState = Boolean(userState && listingState && userState === listingState);

      const urgency = hoursLeft;
      const distanceScore = dist ?? (sameCity ? 5 : sameState ? 25 : 100);
      const sortKey = urgency * 1000 + distanceScore - (sameCity ? 50 : sameState ? 20 : 0);

      return {
        listing: {
          ...listing,
          hoursLeft,
          distanceMiles: dist,
          locationLabel: locationLabel(listing),
        },
        sortKey,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ listing }) => listing);
}

export async function fetchCuratedLeftovers(
  context: LeftoverCurationContext,
  limit = 20,
): Promise<CuratedLeftover[]> {
  await supabase.rpc('expire_leftover_listings');
  const { data, error } = await supabase
    .from('leftover_listings')
    .select(LISTING_SELECT)
    .eq('status', 'active')
    .gt('quantity_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .lte('available_from', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(80);

  if (error) throw error;
  return curateLeftovers((data as unknown as LeftoverListing[]) ?? [], context).slice(0, limit);
}

export async function fetchLeftoverById(id: string): Promise<LeftoverListing | null> {
  const { data, error } = await supabase
    .from('leftover_listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as LeftoverListing | null) ?? null;
}

export function formatExpiresIn(hoursLeft: number): string {
  if (hoursLeft < 1) return 'Under 1 hour left';
  if (hoursLeft < 24) return `${Math.round(hoursLeft)}h left`;
  return `${Math.round(hoursLeft / 24)}d left`;
}

export const EXPIRY_PRESETS = [
  { label: '3 hours', hours: 3 },
  { label: '6 hours', hours: 6 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
] as const;

export function expiresAtFromHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
