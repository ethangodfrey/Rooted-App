import { resolveApiBaseUrl } from '@/lib/tenant/resolve-host';

export type MarketDirectoryContext = {
  id: string;
  name: string;
  slug: string;
  directorySlug: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  locationAddress: string | null;
  operatingHours: string | null;
  themePrimaryColor: string | null;
  themeAccentColor: string | null;
  bannerUrl: string | null;
  eventDescription: string | null;
};

type DirectoryApiResponse = {
  STATUS?: string;
  MARKET?: {
    ID: string;
    NAME: string;
    SLUG: string;
    DIRECTORY_SLUG: string | null;
    DESCRIPTION: string | null;
    CITY: string | null;
    STATE: string | null;
    ADDRESS: string | null;
    OPERATING_HOURS: string | null;
    THEME_PRIMARY_COLOR: string | null;
    THEME_ACCENT_COLOR: string | null;
    BANNER_URL: string | null;
    EVENT_DESCRIPTION: string | null;
  };
};

function mapMarket(body: DirectoryApiResponse['MARKET']): MarketDirectoryContext | null {
  if (!body) return null;
  return {
    id: body.ID,
    name: body.NAME,
    slug: body.SLUG,
    directorySlug: body.DIRECTORY_SLUG,
    description: body.DESCRIPTION,
    city: body.CITY,
    state: body.STATE,
    locationAddress: body.ADDRESS,
    operatingHours: body.OPERATING_HOURS,
    themePrimaryColor: body.THEME_PRIMARY_COLOR,
    themeAccentColor: body.THEME_ACCENT_COLOR,
    bannerUrl: body.BANNER_URL,
    eventDescription: body.EVENT_DESCRIPTION,
  };
}

/**
 * Load Market directory branding for a tenant / subdomain slug.
 * Returns null when the directory row is missing (tenant branding still applies).
 */
export async function getMarketDirectoryBySlug(
  slug: string,
): Promise<MarketDirectoryContext | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const base = resolveApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(
      `${base}/api/markets/directory/${encodeURIComponent(normalized)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Market directory API returned ${response.status}`);
    }

    const body = (await response.json()) as DirectoryApiResponse;
    return mapMarket(body.MARKET);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveMarketBannerText(market: MarketDirectoryContext): string | null {
  return (
    market.description?.trim() ||
    market.eventDescription?.trim() ||
    null
  );
}

export function resolveMarketLocationLine(market: MarketDirectoryContext): string | null {
  const parts = [market.city, market.state].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length > 0) return parts.join(', ');
  return market.locationAddress?.trim() || null;
}
