/**
 * Backfill market photos via Google Places API.
 *
 *   npm run markets:images:google
 *   npm run markets:images:google -- --limit 5
 *   npm run markets:images:google -- --replace
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
  const replace = process.argv.includes('--replace');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const enrichment = app.get(MarketsEnrichmentService);
    let batches = 0;
    let totalUpdated = 0;
    let afterId: string | undefined;

    for (;;) {
      const result = await enrichment.backfillGooglePlacesImages(30, afterId, replace);
      totalUpdated += result.updated;
      batches += 1;

      console.log(JSON.stringify({ batch: batches, ...result, totalUpdated }, null, 2));

      if (result.processed === 0) {
        console.log('No more events to process.');
        break;
      }

      afterId = result.lastId ?? undefined;
      if (result.remaining === 0 && !replace) {
        console.log('Google Places image backfill complete.');
        break;
      }

      if (maxBatches !== undefined && batches >= maxBatches) {
        console.log(`Stopped after ${maxBatches} batch(es).`);
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
