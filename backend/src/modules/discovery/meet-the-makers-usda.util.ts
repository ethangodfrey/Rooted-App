/**
 * USDA National Farmers Market Directory helpers for Meet the Makers.
 * Directory API: https://www.usdalocalfoodportal.com/fe/datasharing/
 */

import {
  fetchUsdaListingDetail,
  resolveUsdaSchedule,
  USDA_REQUEST_HEADERS,
} from '../markets/usda-schedule.util';
import { isUsCountryCode } from '../search/us-geo.util';

export type UsdaDirectorySlug =
  | 'farmersmarket'
  | 'csa'
  | 'agritourism'
  | 'foodhub'
  | 'onfarmmarket';

export type UsdaListingSnapshot = {
  listingId: string;
  directory: UsdaDirectorySlug;
  name: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  hoursSummary: string | null;
  seasonLabel: string | null;
  source: 'usda_detail' | 'usda_directory' | 'cached';
};

const US_STATE_ABBR = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);

const US_STATE_NAMES: Record<string, string> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR',
  CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
  FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
  ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS',
  KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
  MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM',
  'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND',
  OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT',
  VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC',
};

export function parseUsdaExternalId(externalId: string | null | undefined): {
  directory: UsdaDirectorySlug;
  listingId: string;
} | null {
  if (!externalId?.trim()) return null;
  const colon = externalId.indexOf(':');
  if (colon > 0) {
    const directory = externalId.slice(0, colon).toLowerCase() as UsdaDirectorySlug;
    const listingId = externalId.slice(colon + 1).trim();
    if (!listingId) return null;
    return { directory, listingId };
  }
  return { directory: 'farmersmarket', listingId: externalId.trim() };
}

export function normalizeUsStateAbbr(
  state: string | null | undefined,
): string | null {
  if (!state?.trim()) return null;
  const trimmed = state.trim().toUpperCase();
  if (US_STATE_ABBR.has(trimmed)) return trimmed;
  return US_STATE_NAMES[trimmed] ?? null;
}

export function isUsMarketContext(input: {
  vendorCountry?: string | null;
  eventState?: string | null;
  externalSource?: string | null;
}): boolean {
  if (input.externalSource?.toLowerCase() === 'usda') return true;
  if (isUsCountryCode(input.vendorCountry)) {
    if (!input.eventState?.trim()) return true;
    return normalizeUsStateAbbr(input.eventState) != null;
  }
  return normalizeUsStateAbbr(input.eventState) != null;
}

export function getUsdaApiKey(): string | null {
  const key = process.env.USDA_API_KEY?.trim().replace(/\r$/, '') ?? '';
  const placeholders = new Set([
    '',
    'paste_your_key_here',
    'your_usda_api_key_here',
  ]);
  return placeholders.has(key) ? null : key;
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * Fetch farmers-market directory rows for one US state (real-time USDA API).
 */
export async function fetchUsdaFarmersMarketsByState(
  stateAbbr: string,
  options: { apiKey?: string | null; signal?: AbortSignal } = {},
): Promise<UsdaListingSnapshot[]> {
  const abbr = normalizeUsStateAbbr(stateAbbr);
  if (!abbr) return [];
  const apiKey = options.apiKey ?? getUsdaApiKey();
  if (!apiKey) return [];

  const url = `https://www.usdalocalfoodportal.com/api/farmersmarket/?apikey=${encodeURIComponent(apiKey)}&state=${encodeURIComponent(abbr.toLowerCase())}`;
  try {
    const res = await fetch(url, {
      headers: USDA_REQUEST_HEADERS,
      signal: options.signal,
    });
    if (!res.ok) return [];
    const payload: unknown = await res.json();
    if (
      payload === 'apikey error' ||
      (typeof payload === 'string' && payload.includes('apikey'))
    ) {
      return [];
    }
    const records: Record<string, unknown>[] = Array.isArray(payload)
      ? (payload as Record<string, unknown>[])
      : payload &&
          typeof payload === 'object' &&
          Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: unknown[] }).data as Record<string, unknown>[])
        : [];

    const snapshots: UsdaListingSnapshot[] = [];
    for (const raw of records) {
      const listingId = cleanString(raw.listing_id ?? raw.listingid ?? raw.lid);
      if (!listingId) continue;
      snapshots.push({
        listingId,
        directory: 'farmersmarket',
        name: cleanString(raw.listing_name ?? raw.marketname ?? raw.name),
        city: cleanString(raw.location_city ?? raw.city),
        state: normalizeUsStateAbbr(
          cleanString(raw.location_state ?? raw.state) ?? abbr,
        ),
        address: cleanString(raw.location_address ?? raw.address),
        latitude: toFiniteNumber(raw.location_x ?? raw.latitude ?? raw.lat),
        longitude: toFiniteNumber(raw.location_y ?? raw.longitude ?? raw.lng),
        hoursSummary: null,
        seasonLabel: null,
        source: 'usda_directory',
      });
    }
    return snapshots;
  } catch {
    return [];
  }
}

/**
 * Enrich a single USDA listing with operating hours via listinginfo.
 */
export async function enrichUsdaListingHours(input: {
  listingId: string;
  directory?: UsdaDirectorySlug;
  name?: string | null;
}): Promise<UsdaListingSnapshot | null> {
  const directory = input.directory ?? 'farmersmarket';
  const detail = await fetchUsdaListingDetail(input.listingId, directory);
  if (!detail) return null;

  const name =
    cleanString(detail.listing_name ?? detail.marketname ?? detail.name) ??
    input.name ??
    null;
  const schedule = resolveUsdaSchedule({
    name: name ?? 'Farmers Market',
    seasonProductsHtml: detail.seasonproductshtml ?? detail.season_products,
  });

  return {
    listingId: input.listingId,
    directory,
    name,
    city: cleanString(detail.location_city ?? detail.city),
    state: normalizeUsStateAbbr(
      cleanString(detail.location_state ?? detail.state),
    ),
    address: cleanString(detail.location_address ?? detail.address),
    latitude: toFiniteNumber(detail.location_x ?? detail.latitude),
    longitude: toFiniteNumber(detail.location_y ?? detail.longitude),
    hoursSummary: schedule.hoursSummary,
    seasonLabel: schedule.seasonalSchedule,
    source: 'usda_detail',
  };
}

export function formatUsdaMarketDataSyncedLog(input: {
  enriched: number;
  directoryHits: number;
}): string {
  return `USDA_MARKET_DATA_SYNCED ENRICHED=${input.enriched} DIRECTORY_HITS=${input.directoryHits}`;
}
