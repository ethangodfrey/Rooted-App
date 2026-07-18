/**
 * Local Network Seeding & Stress-Testing Engine (CLI)
 *
 * Usage:
 *   DATABASE_URL=... npm run db:seed:network
 *   DATABASE_URL=... npx tsx scripts/seed-local-network.ts
 *
 * Cleans prior @network-seed.vendorly.local rows, then inserts a Denver metro
 * cluster: 25 shoppers, 15 vendors, 10 farmers, connections, follows, listings.
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import {
  formatSeedSummary,
  runLocalNetworkSeed,
} from '../backend/src/modules/admin-agent/local-network-seed.runner';

const require = createRequire(resolve(process.cwd(), 'backend/package.json'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client') as {
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
    const result = await runLocalNetworkSeed(prisma);
    console.log(formatSeedSummary(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`NETWORK SEED FAILED: ${message}`);
  process.exitCode = 1;
});
