/**
 * Normalize, validate, and discover market website / social links.
 *
 *   cd backend
 *   npm run markets:links
 *   npm run markets:links -- --limit 5
 *   npm run markets:links -- --dry-run
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { MarketsLinksService } from '../src/modules/markets/markets-links.service';

function parseLimit(): number | undefined {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return undefined;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main(): Promise<void> {
  const maxBatches = parseLimit();
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const links = app.get(MarketsLinksService);
    let batches = 0;
    let totalUpdated = 0;
    let afterId: string | undefined;

    for (;;) {
      if (dryRun) {
        console.log('Dry run mode is not supported batch-by-batch; run without --dry-run to apply fixes.');
        break;
      }

      const result = await links.backfillLinks(50, afterId);
      totalUpdated += result.updated;
      batches += 1;

      console.log(JSON.stringify({ batch: batches, ...result, totalUpdated }, null, 2));

      if (result.processed === 0) {
        console.log('All public markets processed.');
        break;
      }

      afterId = result.lastId ?? undefined;
      if (result.remaining === 0) {
        console.log('Market links backfill complete.');
        break;
      }

      if (maxBatches !== undefined && batches >= maxBatches) {
        console.log(`Stopped after ${maxBatches} batch(es). ${result.remaining} markets remaining.`);
        break;
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
