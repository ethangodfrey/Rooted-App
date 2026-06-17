/** Parse USDA list `brief_desc` HTML (Open season + Available Products). */
export interface UsdaBriefDesc {
  season: string | null;
  products: string[];
  raw: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBriefDesc(html: string | null | undefined): UsdaBriefDesc | null {
  if (!html?.trim()) return null;

  const raw = stripHtml(html);
  const seasonMatch = raw.match(/Open:\s*([^]+?)(?:Available Products:|$)/i);
  const productsMatch = raw.match(/Available Products:\s*(.+)$/i);

  const season = seasonMatch?.[1]?.trim().replace(/\.$/, '') ?? null;
  const products = productsMatch?.[1]
    ? productsMatch[1]
        .split(';')
        .map((item) => item.trim().replace(/\.$/, ''))
        .filter(Boolean)
    : [];

  return { season, products, raw };
}

/** Extract parking / site notes from USDA detail `address` HTML. */
export function parseDetailAddressHtml(html: string | null | undefined): {
  parking: string | null;
  marketSite: string | null;
  fullAddress: string | null;
} {
  if (!html?.trim()) {
    return { parking: null, marketSite: null, fullAddress: null };
  }

  const parkingMatch = html.match(
    /class=['"]locationdesc[^'"]*['"][^>]*>([^<]+)</i,
  );
  const siteMatch = html.match(
    /Market Site\s*<\/div>\s*<div[^>]*class=['"]mytext[^'"]*['"][^>]*>([^<]+)</i,
  );
  const addressMatch = html.match(
    /class=['"]mytext['"]>([^<]+(?:<[^/][^>]*>[^<]*)?)<\/div><div class=['"]locationdesc/i,
  );

  return {
    parking: parkingMatch?.[1]?.trim() ?? null,
    marketSite: siteMatch?.[1]?.trim() ?? null,
    fullAddress: addressMatch ? stripHtml(addressMatch[1]) : null,
  };
}

export function buildMarketDescription(input: {
  city: string;
  state: string;
  listingDesc?: string | null;
  briefDesc?: string | null;
  typeLabel?: string;
}): string {
  const kind = input.typeLabel?.trim() || 'Farmers market';

  if (input.listingDesc?.trim()) {
    return stripHtml(input.listingDesc);
  }

  const parsed = parseBriefDesc(input.briefDesc);
  if (parsed?.products.length) {
    const productPreview = parsed.products.slice(0, 8).join(', ');
    const more =
      parsed.products.length > 8 ? ` and ${parsed.products.length - 8} more` : '';
    const season = parsed.season ? ` Open ${parsed.season.toLowerCase()}.` : '';
    return `${kind} in ${input.city}, ${input.state}.${season} Vendors often offer: ${productPreview}${more}.`;
  }

  if (parsed?.season) {
    return `${kind} in ${input.city}, ${input.state}. Open ${parsed.season.toLowerCase()}. Hours and vendors may vary — confirm with the organizer.`;
  }

  return `${kind} in ${input.city}, ${input.state}. Hours and vendors may vary — confirm with the organizer.`;
}

import {
  normalizeFacebookUrl,
  normalizeInstagramUrl,
} from './market-links';

export function buildExtraInfo(input: {
  products?: string[];
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  seasonalSchedule?: string | null;
  marketSite?: string | null;
}): string | null {
  const lines: string[] = [];

  if (input.seasonalSchedule) lines.push(`Season: ${input.seasonalSchedule}`);
  if (input.products?.length) {
    lines.push(`Products: ${input.products.join('; ')}`);
  }
  if (input.marketSite) lines.push(`Market site: ${input.marketSite}`);
  if (input.contactName) {
    const contact = [input.contactName, input.contactPhone, input.contactEmail]
      .filter(Boolean)
      .join(' · ');
    lines.push(`Contact: ${contact}`);
  }
  const facebook = normalizeFacebookUrl(input.facebook);
  const instagram = normalizeInstagramUrl(input.instagram);
  if (facebook) lines.push(`Facebook: ${facebook}`);
  if (instagram) lines.push(`Instagram: ${instagram}`);

  return lines.length > 0 ? lines.join('\n') : null;
}
