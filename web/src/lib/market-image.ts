import { MARKET_PLACEHOLDER_URL } from '@/constants/images';
import { resolveEventBannerUrl, type EventImageFields } from '@/lib/event-image';

export interface MarketImageFields {
  image_url?: string | null;
  banner_url?: string | null;
  sync_metadata?: Record<string, unknown> | null;
  market_type?: string | null;
}

/** Persisted CDN URL from phase40 seed, legacy banner, or verified proxy path. */
export function resolveMarketHeroUrl(event: MarketImageFields & Partial<EventImageFields>): string {
  const persisted = event.image_url?.trim() || event.banner_url?.trim();
  if (persisted?.startsWith('http')) {
    return persisted;
  }

  const verified = resolveEventBannerUrl(event as EventImageFields);
  if (verified) return verified;

  return MARKET_PLACEHOLDER_URL;
}
