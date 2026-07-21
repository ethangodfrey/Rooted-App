/**
 * Phase 83 deferred-features amend verification.
 *
 * Usage:
 *   npm run test:phase83:amend
 *
 * Success lines (uppercase, no emoji):
 *   PHASE83_AMEND_INITIALIZED
 *   DEFERRED_FEATURES_PORTED
 *   PHASE83_AMEND_VERIFIED
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

const ROOT = join(__dirname, '..');

const REQUIRED = [
  'docs/PHASE83_DEFERRED_FEATURES_AMEND.md',
  'docs/supabase/phase83a_home_private_chef_vendor_types.sql',
  'docs/supabase/phase83b_vendor_connections.sql',
  'web/src/pages/admin/AdminMixAnalyticsPage.tsx',
  'web/src/lib/mix-analytics.ts',
  'web/src/pages/vendor/VendorLoadInPage.tsx',
  'web/src/lib/load-in.ts',
  'web/src/pages/shopper/ShopperMessagesPage.tsx',
  'web/src/pages/vendor/VendorMessagesPage.tsx',
  'web/src/components/messaging/RealtimeChatThread.tsx',
  'web/src/lib/flash-sale.ts',
  'web/src/pages/vendor/VendorFulfillmentSettingsPage.tsx',
  'web/src/lib/vendor-types.ts',
  'web/src/pages/creator/CreatorLayout.tsx',
  'web/src/pages/creator/CreatorListingsPage.tsx',
] as const;

const ROUTES = [
  'mix-analytics',
  'load-in',
  'fulfillment-settings',
  'shopper/messages',
  'VendorMessagesPage',
  'CreatorLayout',
] as const;

function main(): void {
  log('PHASE83_AMEND_INITIALIZED');

  for (const rel of REQUIRED) {
    const path = join(ROOT, rel);
    assert(existsSync(path), `MISSING ${rel}`);
  }
  log(`DEFERRED_FEATURES_PORTED COUNT=${REQUIRED.length}`);

  const app = readFileSync(join(ROOT, 'web/src/App.tsx'), 'utf8');
  for (const needle of ROUTES) {
    assert(app.includes(needle), `ROUTE_MISSING ${needle}`);
  }

  assert(
    existsSync(join(ROOT, 'web/src/components/messaging/ChatThread.tsx')),
    'LEGACY_CHAT_THREAD_PRESERVED',
  );
  assert(
    existsSync(join(ROOT, 'web/src/components/messaging/RealtimeChatThread.tsx')),
    'REALTIME_CHAT_THREAD',
  );

  log('PHASE83_AMEND_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PHASE83_AMEND_FAILED ${message}`);
  process.exitCode = 1;
}
