/**
 * Crawl Vite production bundles including lazy-loaded manual chunks.
 *
 * Entry HTML only references index + react-vendor chunks; vendor-pages,
 * admin-pages, and other split chunks are discovered via import() strings
 * inside fetched JS assets.
 */

const CHUNK_REF_RE = /(?:\.\/|\/assets\/|assets\/)[A-Za-z0-9_.-]+\.js/g;

function resolveChunkRef(ref, currentAsset) {
  if (ref.startsWith('/assets/')) return ref;
  if (ref.startsWith('assets/')) return `/${ref}`;
  if (ref.startsWith('./')) {
    const base = currentAsset.replace(/\/[^/]+$/, '');
    return `${base}/${ref.slice(2)}`;
  }
  return ref;
}

/**
 * @param {string} url Site origin, e.g. https://vendorly-marketplace1.vercel.app
 * @param {{ maxDepth?: number }} [options]
 */
export async function crawlProductionChunks(url, options = {}) {
  const maxDepth = options.maxDepth ?? 6;
  const origin = url.replace(/\/$/, '');

  const html = await fetch(`${origin}/`).then((r) => r.text());
  const entryAssets = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);

  const queue = [...entryAssets];
  const seen = new Set();
  const chunks = [];

  while (queue.length > 0 && chunks.length < 64) {
    const asset = queue.shift();
    if (!asset || seen.has(asset)) continue;
    seen.add(asset);

    const res = await fetch(`${origin}${asset}`);
    if (!res.ok) continue;

    const js = await res.text();
    chunks.push({ path: asset, bytes: js.length, js });

    if (chunks.length >= maxDepth * 8) break;

    for (const match of js.matchAll(CHUNK_REF_RE)) {
      const ref = resolveChunkRef(match[0], asset);
      if (!seen.has(ref)) queue.push(ref);
    }
  }

  const combinedJs = chunks.map((c) => c.js).join('\n');
  return {
    origin,
    entryAssets,
    chunkPaths: chunks.map((c) => c.path),
    chunkCount: chunks.length,
    combinedJs,
    includesLazyVendorChunk: chunks.some((c) => c.path.includes('vendor-pages')),
    includesLazyAdminChunk: chunks.some((c) => c.path.includes('admin-pages')),
  };
}

/**
 * @param {string} combinedJs
 * @param {string[]} markers
 */
export function findMarkers(combinedJs, markers) {
  return markers.filter((m) => combinedJs.includes(m));
}

/**
 * Audit production env strings across all crawled chunks (not entry-only).
 * @param {string} url
 */
export async function auditProductionEnv(url) {
  const crawl = await crawlProductionChunks(url);
  const { combinedJs, entryAssets, chunkPaths } = crawl;

  const entryOnlyJs = (
    await Promise.all(
      entryAssets.map((asset) => fetch(`${url.replace(/\/$/, '')}${asset}`).then((r) => r.text())),
    )
  ).join('\n');

  const apiUrlInEntry = entryOnlyJs.includes('api.vendorlymarketplace.app');
  const apiUrlInAnyChunk = combinedJs.includes('api.vendorlymarketplace.app');

  return {
    httpStatus: await fetch(url).then((r) => r.status),
    supabaseUrl: combinedJs.includes('ajedyjbdpjahnhzrxwdj.supabase.co'),
    anonKeyPresent: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(
      combinedJs,
    ),
    apiUrlInEntryChunks: apiUrlInEntry,
    apiUrlInLazyChunks: !apiUrlInEntry && apiUrlInAnyChunk,
    apiUrlPresent: apiUrlInAnyChunk,
    entryAssetCount: entryAssets.length,
    crawledChunkCount: chunkPaths.length,
    chunkPaths,
    includesLazyVendorChunk: crawl.includesLazyVendorChunk,
    includesLazyAdminChunk: crawl.includesLazyAdminChunk,
    monolithicBundle: entryAssets.length === 1,
  };
}
