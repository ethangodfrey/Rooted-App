import type { DiscoveredMarket } from './markets.types';

const MARKET_KEYWORDS =
  /farmers?\s*market|farm\s*market|green\s*market|greenmarket|public\s*market|flea\s*market|craft\s*market|producer\s*market/;

export const VERIFIED_EVENT_IMAGE_SOURCES = new Set([
  'osm_image',
  'wikimedia_commons',
  'wikidata',
  'google_places',
]);

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseOsmWikipediaTitle(rawTags: Record<string, string>): string | null {
  const raw = rawTags.wikipedia?.trim();
  if (!raw) return null;

  const withoutLang = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  return withoutLang || null;
}

export function titleMatchesMarket(title: string, market: DiscoveredMarket): boolean {
  const normalizedTitle = normalizeMatchText(title);
  const normalizedName = normalizeMatchText(market.name);
  const normalizedCity = normalizeMatchText(market.city);

  if (!normalizedTitle || !normalizedName) return false;

  if (normalizedTitle === normalizedName) return true;
  if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) {
    return true;
  }

  const nameTokens = normalizedName.split(' ').filter((token) => token.length > 2);
  if (nameTokens.length === 0) return false;

  const matched = nameTokens.filter((token) => normalizedTitle.includes(token)).length;
  const overlap = matched / nameTokens.length;

  const hasMarketKeyword =
    MARKET_KEYWORDS.test(normalizedTitle) || MARKET_KEYWORDS.test(normalizedName);
  const hasCity = normalizedCity.length > 0 && normalizedTitle.includes(normalizedCity);

  return overlap >= 0.6 && hasMarketKeyword && (hasCity || normalizedTitle.includes('market'));
}

export function placeNameMatchesMarket(
  placeName: string,
  market: DiscoveredMarket,
): boolean {
  const normalizedPlace = normalizeMatchText(placeName);
  const normalizedName = normalizeMatchText(market.name);
  const normalizedCity = normalizeMatchText(market.city);

  if (!normalizedPlace || !normalizedName) return false;

  if (!MARKET_KEYWORDS.test(normalizedPlace) && !MARKET_KEYWORDS.test(normalizedName)) {
    return false;
  }

  if (normalizedPlace === normalizedName) return true;
  if (normalizedPlace.includes(normalizedName) || normalizedName.includes(normalizedPlace)) {
    return true;
  }

  const nameTokens = normalizedName.split(' ').filter((token) => token.length > 2);
  if (nameTokens.length === 0) return false;

  const matched = nameTokens.filter((token) => normalizedPlace.includes(token)).length;
  const overlap = matched / nameTokens.length;
  const hasCity = normalizedCity.length > 0 && normalizedPlace.includes(normalizedCity);

  return overlap >= 0.5 && (hasCity || normalizedPlace.includes('market'));
}

export function isVerifiedImageSource(
  source: string | null | undefined,
  metadata?: Record<string, unknown>,
): boolean {
  if (!source) return false;
  if (VERIFIED_EVENT_IMAGE_SOURCES.has(source)) return true;
  if (source === 'wikipedia') return metadata?.wikipedia_from_osm === true;
  return false;
}
