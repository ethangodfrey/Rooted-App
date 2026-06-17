/**
 * Run the market discovery agent once (no HTTP server).
 *
 *   cd backend
 *   npx ts-node scripts/run-markets-agent.ts
 *
 * Requires DATABASE_URL and phase13 + phase14 SQL migrations applied.
 * Set MARKETS_AGENT_ENABLED=true in backend/.env
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { MarketsAgentService } from '../src/modules/markets/markets-agent.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const agent = app.get(MarketsAgentService);
    if (!agent.isEnabled()) {
      console.error('MARKETS_AGENT_ENABLED is not true — set it in backend/.env');
      process.exit(1);
    }

    const result = await agent.run('manual');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
