import type { Event } from '@/types/database';

const MARKET_TYPE_PRIORITY: Record<string, number> = {
  farmers_market: 100,
  on_farm_market: 80,
  food_hub: 60,
  agritourism: 40,
  csa: 20,
  local_business: 0,
  farm_stand: 10,
};

function normalizeMarketName(name: string): string {
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

function normalizeCity(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeState(state: string): string {
  return state.toUpperCase().trim().slice(0, 2);
}

function marketLocationKey(event: Pick<Event, 'name' | 'city' | 'state' | 'sync_metadata'>): string {
  const zip =
    event.sync_metadata &&
    typeof event.sync_metadata === 'object' &&
    'zipcode' in event.sync_metadata
      ? String((event.sync_metadata as { zipcode?: string }).zipcode ?? '').slice(0, 5)
      : '';

  return `${normalizeMarketName(event.name)}|${normalizeCity(event.city ?? '')}|${normalizeState(event.state ?? '')}|${zip}`;
}

function eventScore(event: Event): number {
  let score = marketTypePriority(event.market_type);
  if (event.hours_summary?.trim()) score += 3;
  if (event.address?.trim()) score += 2;
  if (event.sync_metadata && Object.keys(event.sync_metadata).length > 0) score += 2;
  if (event.banner_url?.trim()) score += 1;
  return score;
}

function marketTypePriority(type: string | null | undefined): number {
  if (!type) return 50;
  return MARKET_TYPE_PRIORITY[type] ?? 30;
}

/** Collapse duplicate public markets (same name + city + state) for list/map display. */
export function dedupeEvents(events: Event[]): Event[] {
  const bestByKey = new Map<string, Event>();

  for (const event of events) {
    const key = marketLocationKey(event);
    const existing = bestByKey.get(key);
    if (!existing || eventScore(event) > eventScore(existing)) {
      bestByKey.set(key, event);
    }
  }

  return [...bestByKey.values()];
}
