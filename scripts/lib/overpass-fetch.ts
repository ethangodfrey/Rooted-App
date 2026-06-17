export const OVERPASS_MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

export const OVERPASS_USER_AGENT =
  'RootedMarketSeeder/1.0 (https://github.com/rooted-app; local data import)';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildFastOverpassQuery(
  bbox: { south: number; west: number; north: number; east: number },
  timeoutSec: number,
): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:${timeoutSec}];
(
  node["amenity"="marketplace"]["marketplace"="farmers_market"](${south},${west},${north},${east});
  way["amenity"="marketplace"]["marketplace"="farmers_market"](${south},${west},${north},${east});
  node["amenity"="marketplace"]["name"](${south},${west},${north},${east});
  way["amenity"="marketplace"]["name"](${south},${west},${north},${east});
);
out center tags;
`.trim();
}

export function buildFullOverpassQuery(
  bbox: { south: number; west: number; north: number; east: number },
  timeoutSec: number,
): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:${timeoutSec}];
(
  node["amenity"="marketplace"]["marketplace"="farmers_market"](${south},${west},${north},${east});
  way["amenity"="marketplace"]["marketplace"="farmers_market"](${south},${west},${north},${east});
  node["amenity"="marketplace"]["name"](${south},${west},${north},${east});
  way["amenity"="marketplace"]["name"](${south},${west},${north},${east});
  node["name"~"Farmers.?Market",i](${south},${west},${north},${east});
  way["name"~"Farmers.?Market",i](${south},${west},${north},${east});
);
out center tags;
`.trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatAbortHint(timeoutMs: number): string {
  return (
    `Request timed out after ${timeoutMs / 1000}s (Overpass blocked or slow on this network). ` +
    `Try: --timeout 120 or --fallback nominatim`
  );
}

export async function fetchOverpassElements(
  query: string,
  options: {
    timeoutMs: number;
    retries?: number;
    onStatus?: (msg: string) => void;
  },
): Promise<OsmElement[]> {
  const retries = options.retries ?? 2;
  let lastError = 'unknown error';

  for (const endpoint of OVERPASS_MIRRORS) {
    const host = new URL(endpoint).host;

    for (let attempt = 1; attempt <= retries; attempt++) {
      options.onStatus?.(`${host} attempt ${attempt}/${retries}...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': OVERPASS_USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 429) {
          lastError = 'HTTP 429 rate limited — wait and retry later';
          await sleep(3000 * attempt);
          continue;
        }

        if (!res.ok) {
          lastError = `HTTP ${res.status} from ${host}`;
          continue;
        }

        const payload = (await res.json()) as { elements?: OsmElement[] };
        return payload.elements ?? [];
      } catch (err) {
        clearTimeout(timer);
        const raw = err instanceof Error ? err.message : String(err);
        lastError =
          raw.includes('aborted') || raw.includes('AbortError')
            ? formatAbortHint(options.timeoutMs)
            : raw;
        if (attempt < retries) await sleep(1500 * attempt);
      }
    }
  }

  throw new Error(lastError);
}
