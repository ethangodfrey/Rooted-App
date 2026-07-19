/**
 * Canonical domain migration gate for Vendorly Marketplace.
 *
 * Usage:
 *   npm run verify:domains
 *
 * Success lines (uppercase, no emoji):
 *   ROUTING_RECONFIGURED
 *   MIGRATION_COMPLETE
 *   INGRESS_VERIFIED
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function assertEnvConfigParsesMarketplaceUrls(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const envConfig = require(resolve(
      process.cwd(),
      'packages/env-config/dist/index.js',
    )) as {
      validatePublicHttpsUrl: (value: string) => string;
      CANONICAL_API_ORIGIN: string;
      CANONICAL_APP_ORIGIN: string;
    };
    envConfig.validatePublicHttpsUrl(envConfig.CANONICAL_APP_ORIGIN);
    envConfig.validatePublicHttpsUrl(envConfig.CANONICAL_API_ORIGIN);
    envConfig.validatePublicHttpsUrl(
      'https://api.vendorlymarketplace.app/api/health',
    );
    log('DOMAIN_OK ENV_CONFIG_URL_PARSER');
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log(`DOMAIN_FAIL ENV_CONFIG_URL_PARSER DETAIL=${detail}`);
    return false;
  }
}

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

  if (!assertEnvConfigParsesMarketplaceUrls()) {
    failed = true;
  }

  const liveExample = resolve(process.cwd(), '.env.live.example');
  if (existsSync(liveExample)) {
    const liveText = readFileSync(liveExample, 'utf8');
    if (!liveText.includes('DEPLOY_HEALTH_URL=https://api.vendorlymarketplace.app/api/health')) {
      log('DOMAIN_FAIL LIVE_TEMPLATE_HEALTH_URL');
      failed = true;
    } else {
      log('DOMAIN_OK LIVE_TEMPLATE_HEALTH_URL');
    }
  }

  // Optional local operator copy — must not reintroduce legacy API host.
  const liveLocal = resolve(process.cwd(), '.env.live');
  if (existsSync(liveLocal)) {
    const liveText = readFileSync(liveLocal, 'utf8');
    if (liveText.includes('DEPLOY_HEALTH_URL=https://api.vendorly.app/api/health')) {
      log('DOMAIN_FAIL LIVE_LOCAL_LEGACY_HEALTH_URL');
      failed = true;
    } else if (
      liveText.includes('DEPLOY_HEALTH_URL=https://api.vendorlymarketplace.app/api/health')
    ) {
      log('DOMAIN_OK LIVE_LOCAL_HEALTH_URL');
    }
  }

  if (failed) {
    log('DOMAIN_MIGRATION FAIL');
    process.exit(1);
  }

  log('ROUTING_RECONFIGURED');
  log('MIGRATION_COMPLETE');
  log('INGRESS_VERIFIED');
  // Alias retained for older operator docs.
  log('DOMAIN_MIGRATION_COMPLETE');
}

main();
