import { normalizeImageUrl } from './image.util';

const USER_AGENT = 'RootedMarketsAgent/1.0 (website og:image)';
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 500_000;

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
];

export async function fetchWebsiteOgImage(websiteUrl: string | null | undefined): Promise<string | null> {
  const normalized = normalizeImageUrl(websiteUrl);
  if (!normalized) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(normalized, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    if (html.length > MAX_HTML_BYTES) return null;

    for (const pattern of OG_IMAGE_PATTERNS) {
      const match = html.match(pattern);
      const raw = match?.[1]?.trim();
      if (!raw) continue;

      const absolute = resolveMaybeRelativeUrl(raw, normalized);
      const imageUrl = normalizeImageUrl(absolute);
      if (imageUrl) return imageUrl;
    }

    return null;
  } catch {
    return null;
  }
}

function resolveMaybeRelativeUrl(raw: string, pageUrl: string): string {
  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return raw;
  }
}
