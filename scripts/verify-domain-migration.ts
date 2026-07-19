/**
 * Canonical domain migration gate for Vendorly Marketplace.
 *
 * Usage:
 *   npm run verify:domains
 *
 * Success lines (uppercase, no emoji):
 *   ROUTING_RECONFIGURED
 *   DOMAIN_MIGRATION_COMPLETE
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED = [
  {
    file: 'deploy/ingress.targets.json',
    needles: [
      'api.vendorlymarketplace.app',
      'https://api.vendorlymarketplace.app',
    ],
  },
  {
    file: 'scripts/lib/production-targets.mjs',
    needles: [
      'https://api.vendorlymarketplace.app',
      'https://vendorlymarketplace.com',
    ],
  },
  {
    file: 'backend/railway.json',
    needles: ['https://api.vendorlymarketplace.app'],
  },
  {
    file: '.env.live.example',
    needles: ['https://api.vendorlymarketplace.app/api/health'],
  },
  {
    file: 'packages/env-config/src/domains.ts',
    needles: [
      'vendorlymarketplace.com',
      'api.vendorlymarketplace.app',
    ],
  },
] as const;

const FORBIDDEN_CANONICAL = [
  'DEPLOY_HEALTH_URL=https://api.vendorly.app/api/health',
  'PUBLIC_BASE_URL": "https://api.vendorly.app"',
  "PRODUCTION_API_URL = 'https://api.vendorly.app'",
];

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log('DOMAIN_MIGRATION CHECK START');
  let failed = false;

  for (const entry of REQUIRED) {
    const path = resolve(process.cwd(), entry.file);
    if (!existsSync(path)) {
      log(`DOMAIN_FAIL MISSING_FILE ${entry.file}`);
      failed = true;
      continue;
    }
    const text = readFileSync(path, 'utf8');
    for (const needle of entry.needles) {
      if (!text.includes(needle)) {
        log(`DOMAIN_FAIL MISSING_NEEDLE FILE=${entry.file} NEEDLE=${needle}`);
        failed = true;
      } else {
        log(`DOMAIN_OK FILE=${entry.file} NEEDLE=${needle}`);
      }
    }
  }

  for (const entry of REQUIRED) {
    const path = resolve(process.cwd(), entry.file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const forbidden of FORBIDDEN_CANONICAL) {
      if (text.includes(forbidden)) {
        log(`DOMAIN_FAIL LEGACY_CANONICAL_PRESENT FILE=${entry.file}`);
        failed = true;
      }
    }
  }

  if (failed) {
    log('DOMAIN_MIGRATION FAIL');
    process.exit(1);
  }

  log('ROUTING_RECONFIGURED');
  log('DOMAIN_MIGRATION_COMPLETE');
}

main();
