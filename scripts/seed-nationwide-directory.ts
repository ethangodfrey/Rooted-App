/**
 * Nationwide Directory Core seed — multi-region markets into public.regions / markets.
 *
 * Usage:
 *   DATABASE_URL=... npm run markets:seed-nationwide
 *
 * Telemetry (uppercase, no emoji):
 *   DIRECTORY_READY
 *   GEO_INDEX_OK
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import {
  NATIONWIDE_MARKETS,
  NATIONWIDE_REGIONS,
} from './lib/nationwide-directory-seed';

const requireFromBackend = createRequire(
  resolve(process.cwd(), 'backend/package.json'),
);
// Resolve Prisma from backend workspace (generated client lives there).
const { PrismaClient } = requireFromBackend('@prisma/client') as {
  PrismaClient: new () => {
    region: {
      upsert: (args: unknown) => Promise<{ id: string; slug: string }>;
    };
    market: {
      upsert: (args: unknown) => Promise<unknown>;
      count: (args: unknown) => Promise<number>;
    };
    $disconnect: () => Promise<void>;
  };
};

function loadEnvFile(filePath: string): void {
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

function log(message: string): void {
  console.log(message);
}

async function main(): Promise<void> {
  const root = process.cwd();
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));

  const dryRun = process.argv.includes('--dry-run');

  log('DIRECTORY_SEED START');
  log(
    `DIRECTORY_SEED REGIONS=${NATIONWIDE_REGIONS.length} MARKETS=${NATIONWIDE_MARKETS.length}`,
  );

  if (dryRun) {
    for (const region of NATIONWIDE_REGIONS) {
      log(`REGION_DRY SLUG=${region.slug}`);
    }
    for (const market of NATIONWIDE_MARKETS) {
      log(
        `MARKET_DRY DIRECTORY_SLUG=${market.directorySlug} STATE=${market.state} CITY=${market.city}`,
      );
    }
    log(`GEO_INDEX_OK COUNT=${NATIONWIDE_MARKETS.length}`);
    log(`DIRECTORY_READY UPSERTED=0 DRY_RUN=1`);
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL REQUIRED');
  }

  const prisma = new PrismaClient();
  try {
    const regionIds = new Map<string, string>();

    for (const region of NATIONWIDE_REGIONS) {
      const row = await prisma.region.upsert({
        where: { slug: region.slug },
        create: {
          name: region.name,
          slug: region.slug,
          timezone: region.timezone,
          geographicBounds: region.geographicBounds,
          status: 'ACTIVE',
        },
        update: {
          name: region.name,
          timezone: region.timezone,
          geographicBounds: region.geographicBounds,
          status: 'ACTIVE',
        },
      });
      regionIds.set(region.slug, row.id);
      log(`REGION_OK SLUG=${region.slug}`);
    }

    let upserted = 0;
    for (const market of NATIONWIDE_MARKETS) {
      const regionId = regionIds.get(market.regionSlug);
      if (!regionId) {
        throw new Error(`REGION_MISSING SLUG=${market.regionSlug}`);
      }

      await prisma.market.upsert({
        where: {
          regionId_slug: {
            regionId,
            slug: market.slug,
          },
        },
        create: {
          regionId,
          name: market.name,
          slug: market.slug,
          directorySlug: market.directorySlug,
          locationAddress: market.locationAddress,
          city: market.city,
          state: market.state,
          latitude: market.latitude,
          longitude: market.longitude,
          operatingHours: market.operatingHours,
          status: 'ACTIVE',
        },
        update: {
          name: market.name,
          directorySlug: market.directorySlug,
          locationAddress: market.locationAddress,
          city: market.city,
          state: market.state,
          latitude: market.latitude,
          longitude: market.longitude,
          operatingHours: market.operatingHours,
          status: 'ACTIVE',
        },
      });
      upserted += 1;
      log(
        `MARKET_OK DIRECTORY_SLUG=${market.directorySlug} STATE=${market.state} CITY=${market.city}`,
      );
    }

    const geoCount = await prisma.market.count({
      where: {
        status: 'ACTIVE',
        latitude: { not: null },
        longitude: { not: null },
        state: { not: null },
        city: { not: null },
      },
    });

    log(`GEO_INDEX_OK COUNT=${geoCount}`);
    log(`DIRECTORY_READY UPSERTED=${upserted}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`FAIL: ${message}`);
  process.exit(1);
});
