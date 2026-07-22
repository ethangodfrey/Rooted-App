/**
 * Phase 83 feature amendments verification.
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
  'backend/src/modules/vendor-network/vendor-classification.ts',
  'backend/src/modules/vendor-network/v2v-connections.service.ts',
  'backend/src/modules/vendor-network/v2v-connections.controller.ts',
  'backend/src/modules/vendor-network/flash-promo.util.ts',
  'backend/src/modules/vendor-network/flash-promo.service.ts',
  'backend/src/modules/vendor-network/flash-promo.controller.ts',
  'backend/src/modules/vendor-network/vendor-network.module.ts',
  'web/src/pages/admin/AdminMixAnalyticsPage.tsx',
  'web/src/pages/admin/AdminAnalyticsPage.tsx',
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
  'analytics',
  'load-in',
  'fulfillment-settings',
  'shopper/messages',
  'VendorMessagesPage',
  'CreatorLayout',
  'AdminAnalyticsPage',
] as const;

const BACKEND_MARKERS = [
  ['backend/src/modules/vendor-network/vendor-classification.ts', 'HOME'],
  ['backend/src/modules/vendor-network/vendor-classification.ts', 'PRIVATE_CHEF'],
  ['backend/src/modules/vendor-network/vendor-classification.ts', 'MICRO_BRAND'],
  ['backend/src/modules/vendor-network/v2v-connections.service.ts', 'V2V_CONNECTION_REQUESTED'],
  ['backend/src/modules/vendor-network/flash-promo.util.ts', 'FLASH_PROMO_INVALID'],
  ['backend/src/app.module.ts', 'VendorNetworkModule'],
  ['backend/prisma/schema.prisma', 'cottageFoodDisclosure'],
  ['backend/prisma/schema.prisma', 'isFollowing'],
  ['backend/prisma/schema.prisma', 'themeSettings'],
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

  for (const [rel, needle] of BACKEND_MARKERS) {
    const body = readFileSync(join(ROOT, rel), 'utf8');
    assert(body.includes(needle), `MARKER_MISSING ${rel} ${needle}`);
  }

  assert(
    existsSync(join(ROOT, 'web/src/components/messaging/ChatThread.tsx')),
    'LEGACY_CHAT_THREAD_PRESERVED',
  );
  assert(
    existsSync(join(ROOT, 'web/src/components/messaging/RealtimeChatThread.tsx')),
    'REALTIME_CHAT_THREAD',
  );

  const flashSale = readFileSync(join(ROOT, 'web/src/lib/flash-sale.ts'), 'utf8');
  assert(!flashSale.includes('⚡'), 'FLASH_SALE_EMOJI_FORBIDDEN');

  log('PHASE83_AMEND_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PHASE83_AMEND_FAILED ${message}`);
  process.exitCode = 1;
}
