const PRODUCT_MEDIA_MARKER = '/storage/v1/object/public/product-media/';

export function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let url = raw.trim();
  if (url.startsWith('//')) url = `https:${url}`;
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Only show images uploaded to our product-media bucket — avoids stale or unrelated URLs. */
export function isTrustedMediaUrl(url: string | null | undefined): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  return normalized.includes(PRODUCT_MEDIA_MARKER);
}

export function pickProductDisplayImage(options: {
  mediaUrls?: string[] | null;
  vendorLogoUrl?: string | null;
}): string | null {
  for (const raw of options.mediaUrls ?? []) {
    if (isTrustedMediaUrl(raw)) return normalizeImageUrl(raw);
  }
  if (isTrustedMediaUrl(options.vendorLogoUrl)) {
    return normalizeImageUrl(options.vendorLogoUrl);
  }
  return null;
}

export function pickListingDisplayImage(mediaUrl: string | null | undefined): string | null {
  return isTrustedMediaUrl(mediaUrl) ? normalizeImageUrl(mediaUrl) : null;
}
