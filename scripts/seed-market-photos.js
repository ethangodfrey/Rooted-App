/**
 * seed-market-photos.js
 *
 * Isolated background utility: fetch Google Place photos once, persist static
 * image_url strings in Supabase so the frontend never hits Places billing on scroll.
 *
 * Usage:
 *   npm run markets:seed-photos
 *   node scripts/seed-market-photos.js --limit 25
 *   node scripts/seed-market-photos.js --limit 10 --dry-run
 *
 * Required environment (never commit keys):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_PLACES_API_KEY   (or GOOGLE_API_KEY)
 *
 * Optional:
 *   VITE_SUPABASE_URL         SUPABASE_URL fallback
 *   MARKET_TABLE              default events (public farmer markets)
 *   MARKET_PHOTO_BATCH_SIZE   default 50
 *   MARKET_PHOTO_DELAY_MS     default 200
 *
 * Supabase migration (run once):
 *   docs/supabase/phase40_markets_image_url.sql
 */

'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const IMAGE_COLUMN = 'image_url';
const BANNER_COLUMN = 'banner_url';
const DEFAULT_TABLE = 'events';
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_DELAY_MS = 200;
const PHOTO_MAX_WIDTH = 800;
const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800';

// ---------------------------------------------------------------------------
// Environment & CLI
// ---------------------------------------------------------------------------

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadEnv() {
  const root = process.cwd();
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));
  loadEnvFile(resolve(root, 'web/.env'));
}

function parseArgs(argv) {
  const limitIdx = argv.indexOf('--limit');
  const limit =
    limitIdx !== -1
      ? Number(argv[limitIdx + 1])
      : Number(process.env.MARKET_PHOTO_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_BATCH_SIZE,
    dryRun: argv.includes('--dry-run'),
  };
}

function requiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

// ---------------------------------------------------------------------------
// Google Places
// ---------------------------------------------------------------------------

function buildTextSearchUrl(market, apiKey) {
  const query = `${market.name} ${market.city ?? ''}`.trim();
  const params = new URLSearchParams({
    query,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
}

function buildPhotoUrl(photoReference, apiKey) {
  const params = new URLSearchParams({
    maxwidth: String(PHOTO_MAX_WIDTH),
    photo_reference: photoReference,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/place/photo?${params}`;
}

/**
 * @returns {Promise<string | null>} photo_reference or null when no match
 */
async function fetchPhotoReference(market, apiKey) {
  const url = buildTextSearchUrl(market, apiKey);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Text Search HTTP ${res.status}`);
  }

  const payload = await res.json();
  if (payload.status && !['OK', 'ZERO_RESULTS'].includes(payload.status)) {
    throw new Error(`${payload.status}: ${payload.error_message ?? 'Google Places error'}`);
  }

  if (!payload.results?.length) {
    return null;
  }

  const photoReference = payload.results[0]?.photos?.[0]?.photo_reference;
  return typeof photoReference === 'string' && photoReference.trim()
    ? photoReference.trim()
    : null;
}

function resolveImageUrl(photoReference, apiKey) {
  if (photoReference) {
    return buildPhotoUrl(photoReference, apiKey);
  }
  return FALLBACK_IMAGE_URL;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function createSupabaseClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchMarketsWithoutImages(supabase, table, limit) {
  let query = supabase
    .from(table)
    .select(`id, name, city, state, ${IMAGE_COLUMN}`)
    .is(IMAGE_COLUMN, null)
    .not('name', 'is', null)
    .order('name', { ascending: true })
    .limit(limit);

  if (table === 'events') {
    query = query.eq('visibility_status', 'public');
  }

  return query;
}

async function saveMarketImage(supabase, table, marketId, imageUrl) {
  const patch = {
    [IMAGE_COLUMN]: imageUrl,
    updated_at: new Date().toISOString(),
  };

  // search_index matview still reads banner_url — keep both columns aligned.
  if (table === 'events') {
    patch[BANNER_COLUMN] = imageUrl;
  }

  return supabase.from(table).update(patch).eq('id', marketId);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();
  const { limit, dryRun } = parseArgs(process.argv.slice(2));
  const delayMs = Number(process.env.MARKET_PHOTO_DELAY_MS ?? DEFAULT_DELAY_MS) || DEFAULT_DELAY_MS;
  const table = (process.env.MARKET_TABLE ?? DEFAULT_TABLE).trim() || DEFAULT_TABLE;

  const supabaseUrl = requiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const googleApiKey = requiredEnv('GOOGLE_PLACES_API_KEY', 'GOOGLE_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !googleApiKey) {
    console.error(
      'Missing required env. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GOOGLE_PLACES_API_KEY.',
    );
    process.exit(1);
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey);

  console.log(`Table: ${table}`);
  console.log(`Fetching up to ${limit} market row(s) where ${IMAGE_COLUMN} IS NULL...`);
  if (dryRun) console.log('Dry run — no database writes.');

  const { data: markets, error: fetchError } = await fetchMarketsWithoutImages(
    supabase,
    table,
    limit,
  );

  if (fetchError) {
    console.error(`Database fetch failed: ${fetchError.message}`);
    if (fetchError.message.includes('image_url')) {
      console.error('Run docs/supabase/phase40_markets_image_url.sql in Supabase SQL Editor first.');
    }
    process.exit(1);
  }

  if (!markets?.length) {
    console.log('No markets without images found. Database is up to date.');
    return;
  }

  console.log(`Processing ${markets.length} market(s) with ${delayMs}ms delay between lookups...\n`);

  let saved = 0;
  let fallback = 0;
  let failed = 0;

  for (const market of markets) {
    const label = `${market.name}${market.city ? ` (${market.city})` : ''}`;

    try {
      await sleep(delayMs);

      const photoReference = await fetchPhotoReference(market, googleApiKey);
      const imageUrl = resolveImageUrl(photoReference, googleApiKey);
      const usedFallback = !photoReference;

      if (dryRun) {
        if (usedFallback) fallback += 1;
        else saved += 1;
        console.log(
          `[dry-run] Would save ${label}\n          → ${imageUrl}${usedFallback ? ' (Unsplash fallback)' : ''}`,
        );
        continue;
      }

      const { error: updateError } = await saveMarketImage(supabase, table, market.id, imageUrl);

      if (updateError) {
        failed += 1;
        console.error(`FAILED save ${label}: ${updateError.message}`);
        continue;
      }

      if (usedFallback) {
        fallback += 1;
        console.log(`Saved fallback image for ${label}`);
        console.log(`  image_url: ${imageUrl}`);
      } else {
        saved += 1;
        console.log(`Saved Google Place image for ${label}`);
        console.log(`  image_url: ${imageUrl}`);
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ERROR ${label}: ${message}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`google_places: ${saved}`);
  console.log(`unsplash_fallback: ${fallback}`);
  console.log(`failed: ${failed}`);
  console.log(`total_processed: ${markets.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
