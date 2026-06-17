/**
 * Run the admin vendor review agent once (no HTTP server).
 *
 *   cd backend
 *   npm run admin:agent
 *
 * Requires DATABASE_URL and docs/supabase/phase17_admin_agent.sql applied.
 * Set ADMIN_VENDOR_AGENT_ENABLED=true and OPENAI_API_KEY in backend/.env
 */

import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { AdminVendorAgentService } from '../src/modules/admin-agent/admin-vendor-agent.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const agent = app.get(AdminVendorAgentService);
    if (!agent.isEnabled()) {
      console.error('ADMIN_VENDOR_AGENT_ENABLED is not true — set it in backend/.env');
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
