/**
 * Backfill market banner images from OSM, Wikimedia, and Wikipedia.
 *
 *   npm run markets:images
 *   npm run markets:images -- --limit 5
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
      const result = await enrichment.backfillImages(50, afterId);
      totalUpdated += result.updated;
      batches += 1;

      console.log(JSON.stringify({ batch: batches, ...result, totalUpdated }, null, 2));

      if (result.processed === 0 || result.remaining === 0) {
        console.log('Image backfill complete.');
        break;
      }

      afterId = result.lastId ?? undefined;

      if (maxBatches !== undefined && batches >= maxBatches) {
        console.log(`Stopped after ${maxBatches} batch(es). ${result.remaining} events still need images.`);
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
