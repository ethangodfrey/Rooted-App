import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);

  const rows = await prisma.$queryRaw<{ typical_day: string; cnt: bigint }[]>`
    SELECT coalesce(sync_metadata->>'typical_day', 'unknown') AS typical_day, count(*) AS cnt
    FROM public.events
    WHERE visibility_status = 'public' AND external_source = 'usda'
    GROUP BY 1 ORDER BY cnt DESC`;

  console.log('USDA typical_day counts:');
  for (const row of rows) {
    console.log(`  ${row.typical_day}: ${row.cnt}`);
  }

  await app.close();
}

main();
