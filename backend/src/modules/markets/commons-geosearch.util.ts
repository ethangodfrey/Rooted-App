import type { DiscoveredMarket } from './markets.types';
import { normalizeMatchText, titleMatchesMarket } from './market-image-match.util';

const MARKET_KEYWORDS =
  /farmers?\s*market|farm\s*market|green\s*market|greenmarket|public\s*market|flea\s*market|craft\s*market|producer\s*market|market\s*stall/;

const IMAGE_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const USER_AGENT = 'RootedMarketsAgent/1.0 (commons geosearch)';

export function commonsTitleLooksRelevant(title: string, market: DiscoveredMarket): boolean {
  const normalizedTitle = normalizeMatchText(title.replace(/^file:/i, ''));
  const normalizedCity = normalizeMatchText(market.city);
  const normalizedName = normalizeMatchText(market.name);

  if (!normalizedTitle) return false;
  if (!MARKET_KEYWORDS.test(normalizedTitle) && !MARKET_KEYWORDS.test(normalizedName)) {
    return false;
  }

  if (titleMatchesMarket(title, market)) return true;

  const hasCity = normalizedCity.length > 0 && normalizedTitle.includes(normalizedCity);
  const hasMarketWord = /market|farm|produce|vendor|stall|farmers/.test(normalizedTitle);

  return hasCity && hasMarketWord;
}

export async function fetchCommonsGeosearchCandidates(
  market: DiscoveredMarket,
  radiusMeters = 800,
  limit = 12,
): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggsprimary: 'all',
    ggsradius: String(Math.min(Math.max(radiusMeters, 100), 5000)),
    ggscoord: `${market.latitude}|${market.longitude}`,
    ggslimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const payload = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; imageinfo?: { url?: string; mime?: string }[] }
        >;
      };
    };

    const urls: string[] = [];
    for (const page of Object.values(payload.query?.pages ?? {})) {
      const title = page.title ?? '';
      if (!commonsTitleLooksRelevant(title, market)) continue;

      const info = page.imageinfo?.[0];
      const mime = info?.mime ?? '';
      const url = info?.url;
      if (!url || !IMAGE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) continue;

      urls.push(url);
    }

    return urls;
  } catch {
    return [];
  }
}
