/**
 * Local Network Seeding & Stress-Testing Engine (CLI)
 *
 * Usage:
 *   DATABASE_URL=... npm run db:seed:network
 *   DATABASE_URL=... ts-node scripts/seed-local-network.ts
 *
 * Inserts a Denver metro cluster (39.7392 N, -104.9903 W) with slight offsets:
 *   25 shoppers  — localized shopper_interests arrays
 *   15 vendors   — vendor_specialties + inventory + POS stubs
 *   10 farmers   — farmer_specialties + wholesale bulk descriptions
 *   10 vendor_connections + 30 follows
 *
 * Cleans prior @network-seed.vendorly.local rows in FK-safe order
 * (preorder items/orders, follows, connections, products, then profiles).
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path') as typeof import('path');
const { config: loadEnv } = require('dotenv') as typeof import('dotenv');

loadEnv({ path: path.resolve(process.cwd(), 'backend/.env') });
loadEnv();

const {
  formatSeedSummary,
  runLocalNetworkSeed,
} = require('../backend/src/modules/admin-agent/local-network-seed.runner') as typeof import('../backend/src/modules/admin-agent/local-network-seed.runner');

const { PrismaClient } = require(path.resolve(
  process.cwd(),
  'backend/node_modules/@prisma/client',
)) as {
  PrismaClient: new () => {
    $executeRaw: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<unknown>;
    $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
    $queryRaw: <T = unknown>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<T>;
    $disconnect: () => Promise<void>;
  };
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient();
  try {
    console.log('NETWORK SEED: START DENVER CLUSTER');
    console.log('NETWORK SEED: CENTER 39.7392 N, -104.9903 W');
    const result = await runLocalNetworkSeed(prisma);
    console.log(formatSeedSummary(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`NETWORK SEED FAILED: ${message}`);
  process.exitCode = 1;
});
