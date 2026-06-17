/**
 * Backfill correct local times + website URLs for every event (no AI).
 *
 *   cd backend
 *   npm run markets:fix-times
 *   npm run markets:fix-times -- --limit 10
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { MarketsEnrichmentService } from '../src/modules/markets/markets-enrichment.service';

function parseLimit(): number | undefined {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return undefined;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main(): Promise<void> {
  const maxBatches = parseLimit();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const enrichment = app.get(MarketsEnrichmentService);
    let batches = 0;
    let totalUpdated = 0;
    let afterId: string | undefined;

    for (;;) {
      const result = await enrichment.backfillTimesAndWebsites(100, afterId);
      totalUpdated += result.updated;
      batches += 1;

      console.log(JSON.stringify({ batch: batches, ...result, totalUpdated }, null, 2));

      if (result.processed === 0) {
        console.log('All events processed.');
        break;
      }

      afterId = result.lastId ?? undefined;
      if (result.remaining === 0) {
        console.log('Times and websites backfill complete.');
        break;
      }

      if (maxBatches !== undefined && batches >= maxBatches) {
        console.log(`Stopped after ${maxBatches} batch(es). ${result.remaining} events remaining.`);
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
