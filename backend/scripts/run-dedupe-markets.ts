/**
 * Hide duplicate public markets in Supabase (same normalized name + city + state).
 * Keeps the richest record; sets duplicates to visibility_status = 'draft'.
 *
 *   cd backend
 *   npm run markets:dedupe
 *   npm run markets:dedupe -- --dry-run
 */

import { PrismaClient } from '@prisma/client';

import {
  marketLocationKey,
  marketTypePriority,
} from '../../scripts/lib/market-dedupe';

const prisma = new PrismaClient();

type PublicEvent = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  marketType: string | null;
  hoursSummary: string | null;
  address: string | null;
  bannerUrl: string | null;
  externalSource: string | null;
  externalId: string | null;
  syncMetadata: unknown;
};

function zipFromMetadata(syncMetadata: unknown): string {
  if (!syncMetadata || typeof syncMetadata !== 'object') return '';
  const zip = (syncMetadata as { zipcode?: string }).zipcode;
  return typeof zip === 'string' ? zip.slice(0, 5) : '';
}

function eventScore(event: PublicEvent): number {
  let score = marketTypePriority(event.marketType);
  if (event.hoursSummary?.trim()) score += 3;
  if (event.address?.trim()) score += 2;
  if (event.bannerUrl?.trim()) score += 1;
  if (event.syncMetadata && typeof event.syncMetadata === 'object') {
    if (Object.keys(event.syncMetadata as object).length > 0) score += 2;
  }
  if (event.externalSource === 'usda') score += 1;
  return score;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const events = await prisma.event.findMany({
    where: { visibilityStatus: 'public' },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      marketType: true,
      hoursSummary: true,
      address: true,
      bannerUrl: true,
      externalSource: true,
      externalId: true,
      syncMetadata: true,
    },
  });

  const groups = new Map<string, PublicEvent[]>();

  for (const event of events) {
    const key = marketLocationKey(
      event.name,
      event.city ?? '',
      event.state ?? '',
      zipFromMetadata(event.syncMetadata),
    );
    const bucket = groups.get(key) ?? [];
    bucket.push(event);
    groups.set(key, bucket);
  }

  const duplicateIds: string[] = [];
  let duplicateGroups = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    duplicateGroups += 1;
    const sorted = [...group].sort((a, b) => eventScore(b) - eventScore(a));
    for (const loser of sorted.slice(1)) {
      duplicateIds.push(loser.id);
    }
  }

  console.log(
    JSON.stringify(
      {
        publicEvents: events.length,
        duplicateGroups,
        toHide: duplicateIds.length,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (duplicateIds.length === 0) {
    console.log('No duplicate public markets found.');
    return;
  }

  if (dryRun) {
    console.log('Dry run — no rows updated. Re-run without --dry-run to hide duplicates.');
    return;
  }

  const batchSize = 200;
  let hidden = 0;

  for (let i = 0; i < duplicateIds.length; i += batchSize) {
    const batch = duplicateIds.slice(i, i + batchSize);
    const result = await prisma.event.updateMany({
      where: { id: { in: batch } },
      data: { visibilityStatus: 'draft' },
    });
    hidden += result.count;
  }

  console.log(`✔ Hid ${hidden} duplicate market(s) (visibility_status = draft).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
