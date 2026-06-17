/**
 * Fix USDA market days/times from USDA listing detail API (seasonproducts HTML).
 *
 *   cd backend
 *   npm run markets:usda:fix-schedules
 *   npm run markets:usda:fix-schedules -- --limit 100
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { nextMarketWindow } from '../src/modules/markets/market-schedule.util';
import { MARKETS_ENRICHMENT_VERSION } from '../src/modules/markets/markets.types';
import { resolveTimezone } from '../src/modules/markets/timezone.util';
import {
  fetchUsdaListingDetail,
  inferDayFromMarketName,
  resolveUsdaSchedule,
} from '../src/modules/markets/usda-schedule.util';
import { PrismaService } from '../src/prisma/prisma.service';

function parseLimit(): number | undefined {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return undefined;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseUsdaExternalId(externalId: string): {
  listingId: string;
  directory: string;
} {
  const idx = externalId.indexOf(':');
  if (idx > 0) {
    return {
      directory: externalId.slice(0, idx),
      listingId: externalId.slice(idx + 1),
    };
  }
  return { directory: 'farmersmarket', listingId: externalId };
}

async function main(): Promise<void> {
  const limit = parseLimit();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const events = await prisma.event.findMany({
      where: {
        visibilityStatus: 'public',
        externalSource: 'usda',
        externalId: { not: null },
      },
      orderBy: { id: 'asc' },
      take: limit,
    });

    let updated = 0;
    let fromDetail = 0;
    let fromName = 0;
    let unchanged = 0;

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      const { listingId, directory } = parseUsdaExternalId(event.externalId!);
      const detail = await fetchUsdaListingDetail(listingId, directory);
      const schedule = resolveUsdaSchedule({
        name: event.name,
        seasonProductsHtml: detail?.seasonproducts,
      });

      if (schedule.source === 'usda_detail') fromDetail += 1;
      else if (schedule.source === 'market_name') fromName += 1;

      const timezone = resolveTimezone(
        Number(event.latitude),
        Number(event.longitude),
        event.state,
      );
      const { start, end } = nextMarketWindow(
        schedule.typicalDay,
        schedule.startHour,
        schedule.endHour,
        timezone,
      );

      const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
      const previousDay =
        typeof metadata.typical_day === 'string' ? metadata.typical_day : null;

      const changed =
        previousDay !== schedule.typicalDay ||
        event.hoursSummary !== schedule.hoursSummary ||
        event.startDatetime.getTime() !== start.getTime();

      if (!changed) {
        unchanged += 1;
      } else {
        await prisma.event.update({
          where: { id: event.id },
          data: {
            startDatetime: start,
            endDatetime: end,
            hoursSummary: schedule.hoursSummary,
            timezone,
            syncMetadata: {
              ...metadata,
              opening_hours: schedule.openingHours,
              typical_day: schedule.typicalDay,
              runs_on_days: schedule.runsOnDays,
              start_hour: schedule.startHour,
              end_hour: schedule.endHour,
              seasonal_schedule: schedule.seasonalSchedule,
              schedule_source: schedule.source,
              enrichment_version: MARKETS_ENRICHMENT_VERSION,
            },
            updatedAt: new Date(),
          },
        });
        updated += 1;
      }

      if ((i + 1) % 25 === 0 || i === events.length - 1) {
        process.stdout.write(
          `\rProcessed ${i + 1}/${events.length} · updated=${updated} · detail=${fromDetail} · name=${fromName}`,
        );
      }

      await sleep(120);
    }

    console.log(
      `\n✔ USDA schedule fix complete: updated=${updated}, unchanged=${unchanged}, detail=${fromDetail}, name=${fromName}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
