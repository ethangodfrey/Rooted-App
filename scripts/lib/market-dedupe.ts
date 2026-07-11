import type { MarketCsvRow } from './market-csv';
import { normalizeState } from './market-csv';

const MARKET_TYPE_PRIORITY: Record<string, number> = {
  farmers_market: 100,
  on_farm_market: 80,
  food_hub: 60,
  agritourism: 40,
  csa: 20,
  farm_stand: 10,
  local_business: 0,
};

export function normalizeMarketName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCity(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Stable identity for the same physical market across USDA directories / imports. */
export function marketLocationKey(
  name: string,
  city: string,
  state: string,
  zipcode?: string | null,
): string {
  const normName = normalizeMarketName(name);
  const normCity = normalizeCity(city);
  const normState = normalizeState(state);
  const zip = (zipcode ?? '').trim().slice(0, 5);
  return `${normName}|${normCity}|${normState}|${zip}`;
}

export function marketTypePriority(type: string | null | undefined): number {
  if (!type) return 50;
  return MARKET_TYPE_PRIORITY[type] ?? 30;
}

export function marketRowRichness(row: MarketCsvRow): number {
  let score = 0;
  for (const value of Object.values(row)) {
    if (typeof value === 'string' && value.trim()) score += 1;
    else if (typeof value === 'number' && Number.isFinite(value)) score += 1;
    else if (Array.isArray(value) && value.length > 0) score += 1;
  }
  if (row.description?.trim()) score += 2;
  if (row.hours_summary?.trim()) score += 2;
  if (row.website?.trim()) score += 1;
  if (row.extra_info?.trim()) score += 1;
  return score;
}

function rowScore(row: MarketCsvRow): number {
  return marketRowRichness(row) + marketTypePriority(row.market_type);
}

export interface MarketLocationFields {
  name: string;
  city: string;
  state: string;
  zipcode?: string | null;
  market_type?: string | null;
}

export function dedupeByLocation<T extends MarketLocationFields>(
  rows: T[],
  scoreFn: (row: T) => number,
): T[] {
  const sorted = [...rows].sort((a, b) => scoreFn(b) - scoreFn(a));
  const byLocation = new Map<string, T>();

  for (const row of sorted) {
    const key = marketLocationKey(row.name, row.city, row.state, row.zipcode);
    if (!byLocation.has(key)) byLocation.set(key, row);
  }

  return [...byLocation.values()];
}

export function dedupeMarketRows(rows: MarketCsvRow[]): MarketCsvRow[] {
  const byExternalId = new Map<string, MarketCsvRow>();

  const sorted = [...rows].sort((a, b) => rowScore(b) - rowScore(a));
  for (const row of sorted) {
    const externalKey = row.external_id?.trim();
    if (!externalKey) continue;
    if (!byExternalId.has(externalKey)) byExternalId.set(externalKey, row);
  }

  const merged = [
    ...byExternalId.values(),
    ...sorted.filter((row) => !row.external_id?.trim()),
  ];

  return dedupeByLocation(merged, rowScore);
}
