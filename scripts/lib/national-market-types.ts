/**
 * Strict TypeScript types for national farmers market ingestion.
 * Mirrors public.national_farmers_markets and USDA harvest payloads.
 */

export interface NationalMarketScheduleEntry {
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  notes?: string | null;
}

/** Domain record used by the ingestion worker (before DB row mapping). */
export interface NationalFarmersMarketRecord {
  marketName: string;
  streetAddress?: string | null;
  city: string;
  state: string;
  zipCode?: string | null;
  operatingSchedules?: NationalMarketScheduleEntry[];
  /** WGS84 longitude (POINT x). */
  longitude: number;
  /** WGS84 latitude (POINT y). */
  latitude: number;
  source?: string | null;
  externalId?: string | null;
}

/** Supabase REST upsert row for national_farmers_markets. */
export interface NationalFarmersMarketDbRow {
  market_name: string;
  street_address?: string | null;
  city: string;
  state: string;
  zip_code?: string | null;
  operating_schedules: NationalMarketScheduleEntry[];
  latitude: number;
  longitude: number;
  source?: string | null;
  external_id?: string | null;
  updated_at: string;
}

export interface NationalMarketIngestResult {
  total: number;
  inserted: number;
  skipped: number;
  batches: number;
  errors: string[];
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function toDbRow(record: NationalFarmersMarketRecord): NationalFarmersMarketDbRow | null {
  const marketName = record.marketName?.trim();
  const city = record.city?.trim();
  const state = record.state?.trim().toUpperCase();
  if (!marketName || !city || !state) return null;
  if (!isValidCoordinate(record.latitude, record.longitude)) return null;

  return {
    market_name: marketName,
    street_address: record.streetAddress?.trim() || null,
    city,
    state,
    zip_code: record.zipCode?.trim() || null,
    operating_schedules: record.operatingSchedules ?? [],
    latitude: record.latitude,
    longitude: record.longitude,
    source: record.source?.trim() || null,
    external_id: record.externalId?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}
