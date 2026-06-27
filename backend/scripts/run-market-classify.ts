/**
 * Spot-check listings: farmers markets vs local businesses.
 *
 *   cd backend
 *   npm run markets:classify
 *   npm run markets:classify -- --limit 5
 *   npm run markets:classify -- --all
 *   npm run markets:classify -- --no-ai
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { MarketsClassifyAiService } from '../src/modules/markets/markets-classify-ai.service';

function parseLimit(): number | undefined {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return undefined;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main(): Promise<void> {
  const maxBatches = parseLimit();
  const forceAll = process.argv.includes('--all');
  const useAi = !process.argv.includes('--no-ai');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const classify = app.get(MarketsClassifyAiService);
    let batches = 0;
    let totalUpdated = 0;
    let totalRelabeled = 0;
    let totalHidden = 0;

    const pendingStart = await classify.countPending(forceAll);
    console.log(`Classification pending: ${pendingStart} listings`);

    for (;;) {
      const result = await classify.enrichPendingBatch(50, { forceAll, useAi });
      totalUpdated += result.updated;
      totalRelabeled += result.relabeledBusiness;
      totalHidden += result.hiddenFromShopper;
      batches += 1;

      console.log(
        JSON.stringify(
          {
            batch: batches,
            ...result,
            totalUpdated,
            totalRelabeled,
            totalHidden,
          },
          null,
          2,
        ),
      );

      if (result.processed === 0) {
        console.log('No more listings to process.');
        break;
      }

      if (result.remaining === 0) {
        console.log('Classification complete.');
        break;
      }

      if (maxBatches !== undefined && batches >= maxBatches) {
        console.log(`Stopped after ${maxBatches} batch(es). ${result.remaining} still pending.`);
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
