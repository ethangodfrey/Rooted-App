import { resolveApiBaseUrl } from '@/lib/api-url';

export type EventImageSource =
  | 'osm_image'
  | 'wikimedia_commons'
  | 'wikidata'
  | 'google_places'
  | 'commons_geosearch'
  | 'website_og'
  | 'wikipedia'
  | string;

const VERIFIED_SOURCES = new Set([
  'osm_image',
  'wikimedia_commons',
  'wikidata',
  'google_places',
]);

export interface EventImageFields {
  id: string;
  banner_url: string | null;
  sync_metadata?: Record<string, unknown> | null;
  market_type?: string | null;
}

function apiBaseUrl(): string {
  return resolveApiBaseUrl();
}

export function isVerifiedEventImage(event: EventImageFields): boolean {
  if (!event.banner_url) return false;

  const metadata = event.sync_metadata ?? {};
  if (metadata.image_verified === true) return true;

  const source = metadata.image_source;
  if (typeof source !== 'string') return false;
  if (VERIFIED_SOURCES.has(source)) return true;
  if (source === 'wikipedia') return metadata.wikipedia_from_osm === true;

  return false;
}

export function resolveEventBannerUrl(event: EventImageFields): string | null {
  if (!isVerifiedEventImage(event) || !event.banner_url) return null;

  const url = event.banner_url;
  const apiUrl = apiBaseUrl();
  if (url.includes('/public/markets/') && apiUrl) {
    const path = url.substring(url.indexOf('/public/markets/'));
    return `${apiUrl}${path}`;
  }

  return url;
}

export function eventPlaceholderEmoji(marketType: string | null | undefined): string {
  switch (marketType) {
    case 'farmers_market':
      return '🌽';
    case 'csa':
      return '🥬';
    case 'on_farm_market':
      return '🚜';
    case 'food_hub':
      return '📦';
    case 'agritourism':
      return '🌾';
    case 'flea_market':
      return '🏺';
    case 'public_market':
      return '🏪';
    case 'craft_market':
      return '🎨';
    default:
      return '🧺';
  }
}
