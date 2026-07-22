/**
 * Phase 83 UI integrations verification.
 *
 * Usage:
 *   npm run test:phase83:ui
 *
 * Success lines (uppercase, no emoji):
 *   PHASE83_UI_INITIALIZED
 *   V2V_NETWORK_ACTIVE
 *   PHASE83_UI_VERIFIED
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
  'web/src/lib/v2v-connections.ts',
  'web/src/components/vendor/VendorConnectButton.tsx',
  'web/src/components/vendor/VendorNetworkPanel.tsx',
  'web/src/components/vendor/FlashPromoWidget.tsx',
  'web/src/components/creator/VerticalVideoFeed.tsx',
  'web/src/components/creator/vertical-video-feed.css',
  'web/src/pages/creator/CreatorFeedPage.tsx',
  'web/src/pages/admin/AdminAnalyticsPage.tsx',
  'web/src/pages/vendor/VendorProfilePage.tsx',
  'web/src/pages/vendor/VendorDashboardPage.tsx',
] as const;

const MARKERS = [
  ['web/src/lib/v2v-connections.ts', 'V2V_NETWORK_ACTIVE'],
  ['web/src/lib/v2v-connections.ts', '/api/v2v/connections'],
  ['web/src/components/vendor/VendorConnectButton.tsx', 'acceptV2vConnection'],
  ['web/src/components/vendor/VendorNetworkPanel.tsx', 'connected_vendors'],
  ['web/src/components/vendor/FlashPromoWidget.tsx', '/api/vendors/flash-promo'],
  ['web/src/components/vendor/FlashPromoWidget.tsx', 'MICRO_BRAND'],
  ['web/src/components/creator/VerticalVideoFeed.tsx', 'CREATOR_FEED_ACTIVE'],
  ['web/src/pages/admin/AdminAnalyticsPage.tsx', 'AdminMixAnalyticsPage'],
  ['web/src/pages/vendor/VendorProfilePage.tsx', 'VendorNetworkPanel'],
  ['web/src/pages/vendor/VendorDashboardPage.tsx', 'FlashPromoWidget'],
  ['web/src/App.tsx', 'CreatorFeedPage'],
  ['web/src/App.tsx', 'path="feed"'],
  ['web/src/App.tsx', 'VendorDashboardPage'],
] as const;

function main(): void {
  log('PHASE83_UI_INITIALIZED');

  for (const rel of REQUIRED) {
    assert(existsSync(join(ROOT, rel)), `MISSING ${rel}`);
  }

  for (const [rel, needle] of MARKERS) {
    const body = readFileSync(join(ROOT, rel), 'utf8');
    assert(body.includes(needle), `MARKER_MISSING ${rel} ${needle}`);
    assert(!body.includes('⚡'), `EMOJI_FORBIDDEN ${rel}`);
  }

  const v2v = readFileSync(join(ROOT, 'web/src/lib/v2v-connections.ts'), 'utf8');
  assert(v2v.includes('formatV2vNetworkActiveLog'), 'V2V_HELPER_MISSING');
  log('V2V_NETWORK_ACTIVE');

  const app = readFileSync(join(ROOT, 'web/src/App.tsx'), 'utf8');
  assert(app.includes('AdminAnalyticsPage'), 'ADMIN_ANALYTICS_ROUTE');
  assert(app.includes('path="analytics"'), 'ADMIN_ANALYTICS_PATH');

  log('PHASE83_UI_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PHASE83_UI_FAILED ${message}`);
  process.exitCode = 1;
}
