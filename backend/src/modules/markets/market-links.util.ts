import { normalizeWebsiteUrl } from './website.util';

export interface MarketLinks {
  website: string | null;
  facebook: string | null;
  instagram: string | null;
}

const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

const BLOCKED_WEBSITE_HOSTS = new Set([
  'usdalocalfoodportal.com',
  'www.usdalocalfoodportal.com',
  'example.com',
  'www.example.com',
  'localhost',
]);

function trimValue(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;]+$/g, '').trim();
}

function isFacebookHost(hostname: string): boolean {
  return FACEBOOK_HOSTS.has(hostname.toLowerCase());
}

function isInstagramHost(hostname: string): boolean {
  return INSTAGRAM_HOSTS.has(hostname.toLowerCase());
}

export function normalizeFacebookUrl(raw: string | null | undefined): string | null {
  const value = stripTrailingPunctuation(trimValue(raw));
  if (!value) return null;

  let candidate = value;
  if (!/^https?:\/\//i.test(candidate) && !candidate.includes('facebook.com') && !candidate.includes('fb.com')) {
    const handle = candidate.replace(/^@/, '').replace(/\s+/g, '');
    if (!handle || handle.includes(' ')) return null;
    candidate = `https://www.facebook.com/${handle}`;
  }

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!isFacebookHost(parsed.hostname)) return null;
    parsed.protocol = 'https:';
    parsed.search = '';
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/pages') return null;
    return `https://www.facebook.com${path}`;
  } catch {
    return null;
  }
}

export function normalizeInstagramUrl(raw: string | null | undefined): string | null {
  const value = stripTrailingPunctuation(trimValue(raw));
  if (!value) return null;

  let candidate = value.replace(/^@/, '');
  if (!/^https?:\/\//i.test(candidate) && !candidate.includes('instagram.com')) {
    const handle = candidate.replace(/\s+/g, '');
    if (!handle || !/^[a-zA-Z0-9._]+$/.test(handle)) return null;
    candidate = `https://www.instagram.com/${handle}`;
  }

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!isInstagramHost(parsed.hostname)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    if (['p', 'reel', 'tv', 'stories'].includes(segments[0])) return null;
    return `https://www.instagram.com/${segments[0]}`;
  } catch {
    return null;
  }
}

export function isBlockedWebsiteHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_WEBSITE_HOSTS.has(host)) return true;
  if (isFacebookHost(host) || isInstagramHost(host)) return true;
  return false;
}

export function normalizeMarketWebsiteUrl(raw: string | null | undefined): string | null {
  const normalized = normalizeWebsiteUrl(raw);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (isBlockedWebsiteHost(parsed.hostname)) return null;
    return normalized;
  } catch {
    return null;
  }
}

function readMetaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseLabeledLinks(extraInfo: string | null | undefined): Partial<MarketLinks> {
  const out: Partial<MarketLinks> = {};
  if (!extraInfo?.trim()) return out;

  for (const line of extraInfo.split('\n')) {
    const trimmed = line.trim();
    const facebookMatch = trimmed.match(/^Facebook:\s*(.+)$/i);
    if (facebookMatch) {
      out.facebook = normalizeFacebookUrl(facebookMatch[1]) ?? out.facebook ?? null;
      continue;
    }
    const instagramMatch = trimmed.match(/^Instagram:\s*(.+)$/i);
    if (instagramMatch) {
      out.instagram = normalizeInstagramUrl(instagramMatch[1]) ?? out.instagram ?? null;
    }
  }

  return out;
}

export function extractMarketLinks(input: {
  websiteUrl?: string | null;
  extraInfo?: string | null;
  syncMetadata?: Record<string, unknown> | null;
}): MarketLinks {
  const metadata = input.syncMetadata ?? {};
  const parsed = parseLabeledLinks(input.extraInfo);

  let website =
    normalizeMarketWebsiteUrl(input.websiteUrl) ??
    normalizeMarketWebsiteUrl(readMetaString(metadata, 'website')) ??
    null;
  let facebook =
    normalizeFacebookUrl(readMetaString(metadata, 'facebook_url')) ??
    parsed.facebook ??
    null;
  let instagram =
    normalizeInstagramUrl(readMetaString(metadata, 'instagram_url')) ??
    parsed.instagram ??
    null;

  const websiteCandidate = normalizeWebsiteUrl(input.websiteUrl ?? readMetaString(metadata, 'website'));
  if (websiteCandidate) {
    try {
      const host = new URL(websiteCandidate).hostname;
      if (isFacebookHost(host)) {
        facebook = facebook ?? normalizeFacebookUrl(websiteCandidate);
        website = null;
      } else if (isInstagramHost(host)) {
        instagram = instagram ?? normalizeInstagramUrl(websiteCandidate);
        website = null;
      }
    } catch {
      // ignore
    }
  }

  return { website, facebook, instagram };
}

export function hasAnyMarketLink(links: MarketLinks): boolean {
  return Boolean(links.website || links.facebook || links.instagram);
}
