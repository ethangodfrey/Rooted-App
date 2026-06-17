/**
 * Remove unverified market banner images (e.g. loose Wikipedia search matches).
 *
 *   npm run markets:images:purge
 *   npm run markets:images:purge -- --limit 5
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
    let totalPurged = 0;
    let afterId: string | undefined;

    for (;;) {
      const result = await enrichment.purgeUntrustedEventImages(100, afterId);
      totalPurged += result.purged;
      batches += 1;

      console.log(JSON.stringify({ batch: batches, ...result, totalPurged }, null, 2));

      if (result.processed === 0) {
        console.log('Untrusted image purge complete.');
        break;
      }

      afterId = result.lastId ?? undefined;

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
