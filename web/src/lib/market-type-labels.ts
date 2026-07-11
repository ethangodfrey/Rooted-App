import type { Event } from '@/types/database';

const SHOPPER_MARKET_TYPES = new Set([
  'farmers_market',
  'flea_market',
  'craft_market',
  'public_market',
  'mixed',
]);

const LOCAL_BUSINESS_PATTERN =
  /\b(restaurant|cafe|coffee|bakery|grocery|supermarket|deli|butcher|pharmacy|florist|nursery|garden\s*center|winery|brewery|distillery|boutique|salon|spa|hotel|motel|bank|church|school|museum|theater|cinema)\b/i;

const FARMERS_MARKET_PATTERN =
  /farmers?\s*market|farm\s*market|green\s*market|flea\s*market|craft\s*market|public\s*market/i;

const CATEGORY_LABELS: Record<string, string> = {
  farmers_market: 'Farmers Market',
  on_farm_market: 'On-Farm Market',
  farm_stand: 'Farm Stand',
  csa: 'CSA',
  food_hub: 'Food Hub',
  agritourism: 'Agritourism',
  flea_market: 'Flea Market',
  craft_market: 'Craft Market',
  public_market: 'Public Market',
  local_business: 'Local Business',
  mixed: 'Mixed Market',
  unknown: 'Market',
};

export function formatMarketType(value: string | null | undefined): string | null {
  if (!value) return null;
  return CATEGORY_LABELS[value] ?? value.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function metadataFlag(event: Pick<Event, 'sync_metadata'>, key: string): boolean | null {
  const meta = event.sync_metadata;
  if (!meta || typeof meta !== 'object') return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : null;
}

/** Whether a listing should appear on the shopper map/events browse (farmers markets, etc.). */
export function isShopperMarketEvent(
  event: Pick<Event, 'market_type' | 'name' | 'sync_metadata'>,
): boolean {
  const classified = metadataFlag(event, 'is_shopper_market');
  if (classified !== null) return classified;

  if (event.market_type === 'local_business') return false;
  if (event.market_type && !SHOPPER_MARKET_TYPES.has(event.market_type)) {
    if (['csa', 'food_hub', 'agritourism', 'on_farm_market', 'farm_stand'].includes(event.market_type)) {
      return false;
    }
  }

  if (LOCAL_BUSINESS_PATTERN.test(event.name) && !FARMERS_MARKET_PATTERN.test(event.name)) {
    return false;
  }

  return true;
}

export function filterShopperEvents<T extends Pick<Event, 'market_type' | 'name' | 'sync_metadata'>>(
  events: T[],
): T[] {
  return events.filter(isShopperMarketEvent);
}
