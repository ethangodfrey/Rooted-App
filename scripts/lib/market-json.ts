import { readFileSync } from 'node:fs';

import { dedupeMarkets, normalizeState, type MarketCsvRow } from './market-csv';
import {
  directoryLabel,
  marketTypeForDirectory,
  type UsdaDirectorySlug,
} from './usda-directories';
import { resolveUsdaSchedule, type UsdaParsedSchedule } from './usda-schedule';
import {
  buildExtraInfo,
  buildMarketDescription,
  parseBriefDesc,
  parseDetailAddressHtml,
} from './usda-fields';
import {
  normalizeFacebookUrl,
  normalizeInstagramUrl,
  normalizeWebsiteUrl,
} from './market-links';

export interface UsdaDetailEnrichment {
  parking?: string | null;
  market_site?: string | null;
}

export interface UsdaMarketRecord {
  id: string;
  name: string;
  website: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number | null;
  longitude: number | null;
  listing_desc?: string;
  brief_desc?: string;
  location_address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  media_facebook?: string;
  media_instagram?: string;
  media_twitter?: string;
  usda_updated?: string;
  directory?: UsdaDirectorySlug;
  market_type?: string;
  schedule?: UsdaParsedSchedule;
  detail?: UsdaDetailEnrichment;
}

export function readUsdaMarketsJson(path: string): UsdaMarketRecord[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`Expected JSON array in ${path}`);
  }
  return raw as UsdaMarketRecord[];
}

export function usdaJsonToMarketRows(records: UsdaMarketRecord[]): MarketCsvRow[] {
  const rows: MarketCsvRow[] = [];

  for (const record of records) {
    const name = record.name?.trim();
    const city = record.city?.trim();
    const state = normalizeState(record.state ?? '');
    const latitude = record.latitude;
    const longitude = record.longitude;

    if (!name || !city || !state || latitude == null || longitude == null) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const schedule = record.schedule ?? resolveUsdaSchedule({ name: record.name });
    const brief = parseBriefDesc(record.brief_desc);
    const address =
      record.location_address?.trim() ||
      record.street?.trim() ||
      '';
    const organizer =
      record.contact_name?.trim() || `${city} Market`;
    const parking =
      record.detail?.parking?.trim() ||
      'Check with the market for parking details.';
    const extraInfo = buildExtraInfo({
      products: brief?.products,
      contactName: record.contact_name,
      contactPhone: record.contact_phone,
      contactEmail: record.contact_email,
      facebook: record.media_facebook,
      instagram: record.media_instagram,
      seasonalSchedule: schedule.seasonalSchedule,
      marketSite: record.detail?.market_site,
    });

    const directory = (record.directory ?? 'farmersmarket') as UsdaDirectorySlug;
    const typeLabel = directoryLabel(directory);

    rows.push({
      external_id: String(record.id).trim(),
      name,
      description: buildMarketDescription({
        city,
        state,
        listingDesc: record.listing_desc,
        briefDesc: record.brief_desc,
        typeLabel,
      }),
      organizer_name: organizer,
      address,
      city,
      state,
      zipcode: record.zipcode?.trim() ?? '',
      latitude,
      longitude,
      day_of_week: schedule.typicalDay,
      start_hour: schedule.startHour,
      end_hour: schedule.endHour,
      parking_info: parking,
      admission_info: 'Free admission.',
      source: 'usda',
      website: normalizeWebsiteUrl(record.website?.trim() ?? '') ?? '',
      market_type: record.market_type ?? marketTypeForDirectory(directory),
      hours_summary: schedule.hoursSummary,
      opening_hours: schedule.openingHours,
      seasonal_schedule: schedule.seasonalSchedule,
      runs_on_days: schedule.runsOnDays,
      schedule_source: schedule.source,
      extra_info: extraInfo,
      contact_name: record.contact_name ?? null,
      contact_phone: record.contact_phone ?? null,
      contact_email: record.contact_email ?? null,
      facebook_url: normalizeFacebookUrl(record.media_facebook),
      instagram_url: normalizeInstagramUrl(record.media_instagram),
    });
  }

  return dedupeMarkets(rows);
}

export function applyUsdaDetailToRecord(
  record: UsdaMarketRecord,
  detail: Record<string, string> | null,
): void {
  if (!detail) return;

  const addressBits = parseDetailAddressHtml(detail.address);
  record.detail = {
    parking: addressBits.parking,
    market_site: addressBits.marketSite,
  };

  const schedule = resolveUsdaSchedule({
    name: record.name,
    seasonProductsHtml: detail.seasonproducts,
  });
  record.schedule = schedule;
}
