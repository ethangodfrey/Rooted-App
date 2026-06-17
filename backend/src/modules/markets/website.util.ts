/** Normalize and validate a market website URL. Returns null if invalid or missing. */
export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Pull a website from OSM tags or sync metadata. */
export function extractWebsite(
  rawTags: Record<string, string>,
  metadata: Record<string, unknown>,
  existing?: string | null,
): string | null {
  const candidates = [
    existing,
    typeof metadata.website === 'string' ? metadata.website : null,
    rawTags.website,
    rawTags['contact:website'],
    rawTags.url,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeWebsiteUrl(candidate);
    if (normalized) return normalized;
  }

  return null;
}
