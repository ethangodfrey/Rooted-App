/** Normalize and validate image URLs for market banners. */
export function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let url = raw.trim();
  if (url.startsWith('//')) url = `https:${url}`;
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function commonsFileUrl(tag: string): string | null {
  const raw = tag.replace(/^File:/i, '').trim();
  if (!raw) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(raw)}?width=1200`;
}
