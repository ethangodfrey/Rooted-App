/**
 * AI schedule agent — correct local start/end times for every USDA market.
 *
 * Pipeline per market:
 *   1. Fetch USDA listing detail (official hours HTML)
 *   2. Fall back to OpenAI when USDA data is missing or low-confidence
 *   3. Store times in correct IANA timezone (fixes 2am UTC mix-up)
 *
 *   cd backend
 *   npm run markets:schedule:ai
 *   npm run markets:schedule:ai -- --limit 20
 *   npm run markets:schedule:ai -- --all
 *   npm run markets:schedule:ai -- --no-ai
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { MarketsScheduleAiService } from '../src/modules/markets/markets-schedule-ai.service';

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
    const scheduleAi = app.get(MarketsScheduleAiService);
    let batches = 0;
    let totalUpdated = 0;

    const pendingStart = await scheduleAi.countPending(forceAll);
    console.log(`Schedule enrichment pending: ${pendingStart} markets`);

    for (;;) {
      const result = await scheduleAi.enrichPendingBatch(50, { forceAll, useAi });
      totalUpdated += result.updated;
      batches += 1;

      console.log(
        JSON.stringify(
          {
            batch: batches,
            ...result,
            totalUpdated,
          },
          null,
          2,
        ),
      );

      if (result.processed === 0) {
        console.log('No more markets to process.');
        break;
      }

      if (result.remaining === 0) {
        console.log('✔ Schedule AI enrichment complete.');
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
