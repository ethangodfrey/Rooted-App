/** Import-pipeline link normalization (mirrors backend market-links.util.ts). */

function trimValue(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;]+$/g, '').trim();
}

const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

function isFacebookHost(hostname: string): boolean {
  return FACEBOOK_HOSTS.has(hostname.toLowerCase());
}

function isInstagramHost(hostname: string): boolean {
  return INSTAGRAM_HOSTS.has(hostname.toLowerCase());
}

export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    if (isFacebookHost(parsed.hostname) || isInstagramHost(parsed.hostname)) return null;
    if (parsed.hostname.includes('usdalocalfoodportal.com')) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function normalizeFacebookUrl(raw: string | null | undefined): string | null {
  const value = stripTrailingPunctuation(trimValue(raw));
  if (!value) return null;

  let candidate = value;
  if (!/^https?:\/\//i.test(candidate) && !candidate.includes('facebook.com') && !candidate.includes('fb.com')) {
    const handle = candidate.replace(/^@/, '').replace(/\s+/g, '');
    if (!handle) return null;
    candidate = `https://www.facebook.com/${handle}`;
  }

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

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
