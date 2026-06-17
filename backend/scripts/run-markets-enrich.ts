/**
 * Enrich all catalog markets with schedule, type, and visitor details.
 * Processes in batches until none remain (or --limit batches).
 *
 *   cd backend
 *   npm run markets:enrich
 *   npm run markets:enrich -- --limit 10
 *
 * Requires DATABASE_URL, phase14/15/21 SQL, and OPENAI_API_KEY for best results.
 * Enriches USDA catalog markets with history, vendor categories, shopper tips, and highlights.
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
    let totalEnriched = 0;

    for (;;) {
      const pending = await enrichment.countPending();
      if (pending === 0) {
        console.log('All markets enriched.');
        break;
      }

      console.log(`Pending: ${pending}. Running batch ${batches + 1}...`);
      const result = await enrichment.enrichPending();
      totalEnriched += result.enriched;
      batches += 1;

      console.log(
        JSON.stringify(
          {
            batch: batches,
            ...result,
            totalEnriched,
          },
          null,
          2,
        ),
      );

      if (result.processed === 0) break;
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
