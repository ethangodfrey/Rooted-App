import type { Event } from '@/src/types/database';

export interface MarketLinks {
  website: string | null;
  facebook: string | null;
  instagram: string | null;
}

const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

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

function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) return null;
    if (isFacebookHost(parsed.hostname) || isInstagramHost(parsed.hostname)) return null;
    if (parsed.hostname.includes('usdalocalfoodportal.com')) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function normalizeFacebookUrl(raw: string | null | undefined): string | null {
  const value = stripTrailingPunctuation(trimValue(raw));
  if (!value) return null;
  let candidate = value;
  if (!/^https?:\/\//i.test(candidate) && !candidate.includes('facebook.com') && !candidate.includes('fb.com')) {
    const handle = candidate.replace(/^@/, '').replace(/\s+/g, '');
    if (!handle) return null;
    candidate = `https://www.facebook.com/${handle}`;
  }
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate.replace(/^\/+/, '')}`;
  try {
    const parsed = new URL(candidate);
    if (!isFacebookHost(parsed.hostname)) return null;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/pages') return null;
    return `https://www.facebook.com${path}`;
  } catch {
    return null;
  }
}

function normalizeInstagramUrl(raw: string | null | undefined): string | null {
  const value = stripTrailingPunctuation(trimValue(raw));
  if (!value) return null;
  let candidate = value.replace(/^@/, '');
  if (!/^https?:\/\//i.test(candidate) && !candidate.includes('instagram.com')) {
    const handle = candidate.replace(/\s+/g, '');
    if (!handle || !/^[a-zA-Z0-9._]+$/.test(handle)) return null;
    candidate = `https://www.instagram.com/${handle}`;
  }
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate.replace(/^\/+/, '')}`;
  try {
    const parsed = new URL(candidate);
    if (!isInstagramHost(parsed.hostname)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    return `https://www.instagram.com/${segments[0]}`;
  } catch {
    return null;
  }
}

function readMetaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function extractMarketLinks(event: Pick<Event, 'website_url' | 'extra_info' | 'sync_metadata'>): MarketLinks {
  const metadata = event.sync_metadata ?? {};
  let website = normalizeWebsiteUrl(event.website_url) ?? normalizeWebsiteUrl(readMetaString(metadata, 'website'));
  let facebook = normalizeFacebookUrl(readMetaString(metadata, 'facebook_url'));
  let instagram = normalizeInstagramUrl(readMetaString(metadata, 'instagram_url'));

  if (event.extra_info) {
    for (const line of event.extra_info.split('\n')) {
      const trimmed = line.trim();
      const facebookMatch = trimmed.match(/^Facebook:\s*(.+)$/i);
      if (facebookMatch) facebook = facebook ?? normalizeFacebookUrl(facebookMatch[1]);
      const instagramMatch = trimmed.match(/^Instagram:\s*(.+)$/i);
      if (instagramMatch) instagram = instagram ?? normalizeInstagramUrl(instagramMatch[1]);
    }
  }

  const websiteCandidate = normalizeWebsiteUrl(event.website_url ?? readMetaString(metadata, 'website'));
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

export function extraInfoWithoutSocialLinks(extraInfo: string | null | undefined): string | null {
  if (!extraInfo?.trim()) return null;
  const lines = extraInfo
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^Facebook:/i.test(line) && !/^Instagram:/i.test(line));
  return lines.length > 0 ? lines.join('\n') : null;
}
