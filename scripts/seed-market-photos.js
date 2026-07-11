/**
 * seed-market-photos.js
 *
 * One-time utility: backfill Google Place Photos for public markets missing images.
 *
 * Vendorly stores market hero images on `public.events.banner_url` (surfaced as
 * `image_url` in search_index / discovery APIs). This script updates `banner_url`.
 *
 * Usage:
 *   npm run markets:seed-photos
 *   node scripts/seed-market-photos.js --limit 25
 *   node scripts/seed-market-photos.js --limit 10 --dry-run
 *
 * Required environment (pass via shell — never commit keys):
 *   SUPABASE_URL              https://YOUR_PROJECT.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service-role key (Dashboard → Settings → API)
 *   GOOGLE_PLACES_API_KEY     temporary Google Places API key
 *
 * Optional:
 *   VITE_SUPABASE_URL         used as SUPABASE_URL fallback
 *   MARKET_PHOTO_BATCH_SIZE   default 50
 *   MARKET_PHOTO_DELAY_MS     default 200
 *
 * Example (PowerShell):
 *   $env:SUPABASE_URL="https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   $env:GOOGLE_PLACES_API_KEY="AIza..."
 *   npm run markets:seed-photos -- --limit 20
 *
 * Example (bash):
 *   SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   GOOGLE_PLACES_API_KEY="AIza..." \
 *   node scripts/seed-market-photos.js --limit 20
 */

'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const IMAGE_COLUMN = 'banner_url';
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_DELAY_MS = 200;
const PHOTO_MAX_WIDTH = 1200;

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
    limitIdx !== -1 ? Number(argv[limitIdx + 1]) : Number(process.env.MARKET_PHOTO_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_BATCH_SIZE,
    dryRun: argv.includes('--dry-run'),
  };
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function requiredEnv(name, ...fallbackNames) {
  for (const key of [name, ...fallbackNames]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function buildPhotoUrl(photoReference, apiKey) {
  return `https://maps.googleapis.com/maps/api/place/photo?${new URLSearchParams({
    maxwidth: String(PHOTO_MAX_WIDTH),
    photo_reference: photoReference,
    key: apiKey,
  })}`;
}

async function fetchPhotoReference(market, apiKey) {
  const query = `${market.name} ${market.city}`.trim();
  const params = new URLSearchParams({
    query,
    key: apiKey,
  });

  if (market.latitude != null && market.longitude != null) {
    params.set('location', `${market.latitude},${market.longitude}`);
    params.set('radius', '20000');
  }

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Text Search HTTP ${res.status}`);
  }

  const payload = await res.json();
  if (payload.status && !['OK', 'ZERO_RESULTS'].includes(payload.status)) {
    throw new Error(`${payload.status}: ${payload.error_message ?? 'Google Places error'}`);
  }

  const photoReference = payload.results?.[0]?.photos?.[0]?.photo_reference;
  return typeof photoReference === 'string' && photoReference.trim() ? photoReference.trim() : null;
}

async function main() {
  loadEnv();
  const { limit, dryRun } = parseArgs(process.argv.slice(2));
  const delayMs = Number(process.env.MARKET_PHOTO_DELAY_MS ?? DEFAULT_DELAY_MS) || DEFAULT_DELAY_MS;

  const supabaseUrl = requiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const googleApiKey = requiredEnv('GOOGLE_PLACES_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !googleApiKey) {
    console.error(
      'Missing required env. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GOOGLE_PLACES_API_KEY.',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Fetching up to ${limit} markets with null ${IMAGE_COLUMN}...`);
  if (dryRun) console.log('Dry run enabled — no database writes.');

  const { data: markets, error: fetchError } = await supabase
    .from('events')
    .select(`id, name, city, state, latitude, longitude, ${IMAGE_COLUMN}`)
    .eq('visibility_status', 'public')
    .is(IMAGE_COLUMN, null)
    .not('city', 'is', null)
    .order('name', { ascending: true })
    .limit(limit);

  if (fetchError) {
    console.error(`Supabase fetch failed: ${fetchError.message}`);
    process.exit(1);
  }

  if (!markets?.length) {
    console.log('No markets without photos found. Nothing to do.');
    return;
  }

  console.log(`Processing ${markets.length} market(s)...`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const market of markets) {
    const label = `${market.name}${market.city ? ` (${market.city})` : ''}`;

    try {
      const photoReference = await fetchPhotoReference(market, googleApiKey);
      await sleep(delayMs);

      if (!photoReference) {
        skipped += 1;
        console.log(`Skipped (no photo): ${label}`);
        continue;
      }

      const imageUrl = buildPhotoUrl(photoReference, googleApiKey);

      if (dryRun) {
        updated += 1;
        console.log(`[dry-run] Would update photo for ${market.name}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('events')
        .update({
          [IMAGE_COLUMN]: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', market.id);

      if (updateError) {
        failed += 1;
        console.error(`Failed update for ${label}: ${updateError.message}`);
        continue;
      }

      updated += 1;
      console.log(`Updated photo for ${market.name}`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error for ${label}: ${message}`);
    }

    await sleep(delayMs);
  }

  console.log('');
  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed} total=${markets.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
