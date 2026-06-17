import type { Event } from '@/src/types/database';

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function getFeaturedVendorCategories(event: Event): string[] {
  const fromMeta = readStringList(event.sync_metadata?.featured_vendor_categories);
  if (fromMeta.length > 0) return fromMeta;

  const vendorTypes = event.sync_metadata?.vendor_types;
  if (typeof vendorTypes === 'string' && vendorTypes.trim()) {
    return vendorTypes
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function getShopperTips(event: Event): string[] {
  return readStringList(event.sync_metadata?.shopper_tips);
}

export function hasMarketGuide(event: Event): boolean {
  return Boolean(
    event.what_to_look_for ||
      event.market_highlights ||
      getFeaturedVendorCategories(event).length > 0 ||
      getShopperTips(event).length > 0,
  );
}
