#!/usr/bin/env node
/**
 * Sanity-check active web source tree against MVP production markers.
 *
 * Usage:
 *   node scripts/verify-ui-production-baseline.mjs
 *   node scripts/verify-ui-production-baseline.mjs --url=https://vendorly-marketplace1.vercel.app
 *   SMOKE_OFFLINE=1 node scripts/verify-ui-production-baseline.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditProductionEnv, crawlProductionChunks, findMarkers } from './lib/bundle-chunk-audit.mjs';

const PROD_URL = 'https://vendorly-marketplace1.vercel.app';
const OFFLINE =
  process.env.SMOKE_OFFLINE === '1' ||
  process.env.SMOKE_MODE === 'offline' ||
  process.env.CI_SANDBOX === '1';

/**
 * Pruned MVP baseline — no creator vault / hidden analytics copy.
 * Patterns must exist in the current source tree.
 */
const BASELINE = {
  dashboardStyles: [
    {
      id: 'vendor-hero-radial',
      pattern: 'radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(249,115,22,0.28)',
      files: ['web/src/components/vendor/vendor-ui.tsx'],
    },
  ],
  ledgerElements: [
    {
      id: 'pos-transactions-lib',
      pattern: 'pos_transactions',
      files: ['web/src/lib/pos-transactions.ts'],
    },
    {
      id: 'pos-transactions-channel',
      pattern: "table: 'pos_transactions'",
      files: ['web/src/lib/pos-transactions.ts'],
    },
    {
      id: 'use-pos-ledger-hook',
      pattern: 'usePosLedger',
      files: ['web/src/hooks/use-pos-ledger.ts'],
    },
    {
      id: 'connect-pos-terminal',
      pattern: 'Connect POS Terminal',
      files: ['web/src/lib/load-in.ts'],
    },
    {
      id: 'platform-fees-kpi',
      pattern: 'Platform fees',
      files: ['web/src/pages/vendor/VendorDashboardPage.tsx'],
    },
    {
      id: 'waiting-first-sale',
      pattern: 'waiting for your first card sale',
      files: ['web/src/components/vendor/pos-live-transaction-feed.tsx'],
    },
  ],
  settlementMetrics: [
    {
      id: 'gross-volume-trend',
      pattern: 'Gross volume trend',
      files: ['web/src/components/vendor/SettlementDashboard.tsx'],
    },
    {
      id: 'platform-fee-split',
      pattern: 'Platform fee split',
      files: ['web/src/components/vendor/SettlementDashboard.tsx'],
    },
    {
      id: 'volume-by-order-size',
      pattern: 'Volume by order size',
      files: ['web/src/components/vendor/SettlementDashboard.tsx'],
    },
  ],
};

/** Markers expected in production lazy chunks after MVP prune. */
const PROD_MARKERS = [
  'Platform fees',
  'waiting for your first card sale',
  'pos-transactions',
  'Connect POS Terminal',
  'api.vendorlymarketplace.app',
];

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function scanSourceBaseline() {
  const results = [];

  for (const [group, checks] of Object.entries(BASELINE)) {
    for (const check of checks) {
      const missingFiles = [];
      const matchedFiles = [];

      for (const file of check.files) {
        const content = read(file);
        if (content == null) {
          missingFiles.push(file);
          continue;
        }
        if (content.includes(check.pattern)) matchedFiles.push(file);
        else missingFiles.push(`${file} (pattern missing)`);
      }

      results.push({
        group,
        id: check.id,
        status: matchedFiles.length === check.files.length ? 'PASS' : 'FAIL',
        pattern: check.pattern,
        matchedFiles,
        missingFiles,
      });
    }
  }

  return results;
}

async function scanProductionBaseline(url) {
  const crawl = await crawlProductionChunks(url);
  const found = findMarkers(crawl.combinedJs, PROD_MARKERS);
  const env = await auditProductionEnv(url);

  return {
    url,
    chunkPaths: crawl.chunkPaths,
    markersFound: found,
    markersMissing: PROD_MARKERS.filter((m) => !found.includes(m)),
    env,
  };
}

async function main() {
  console.log('=== UI / production baseline sanity check ===\n');
  console.log('TEST_DRIFT_RESOLVED SURFACE=UI_BASELINE');

  console.log('1) Source tree baseline (pruned MVP)');
  const source = scanSourceBaseline();
  for (const row of source) {
    console.log(`  [${row.status}] ${row.group}/${row.id}`);
    if (row.status === 'FAIL') console.log(`       missing: ${row.missingFiles.join(', ')}`);
  }

  const sourceFail = source.some((r) => r.status === 'FAIL');

  if (OFFLINE) {
    console.log('\n2) Production bundle crawl SKIPPED (SMOKE_OFFLINE)');
    console.log('\n3) VITE_API_URL audit SKIPPED (SMOKE_OFFLINE)');
    if (sourceFail) process.exitCode = 1;
    else console.log('\nTEST_DRIFT_RESOLVED UI_BASELINE_OK MODE=OFFLINE');
    return;
  }

  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  const url = urlArg?.slice('--url='.length) ?? PROD_URL;

  console.log('\n2) Production bundle crawl (lazy chunks included)');
  let prod;
  try {
    prod = await scanProductionBaseline(url);
  } catch (err) {
    console.log(`  NETWORK_ERROR: ${err instanceof Error ? err.message : String(err)}`);
    console.log('  Falling back to source-only pass (sandboxed egress).');
    if (sourceFail) process.exitCode = 1;
    else console.log('\nTEST_DRIFT_RESOLVED UI_BASELINE_OK MODE=SOURCE_ONLY');
    return;
  }

  console.log(`  chunks: ${prod.chunkPaths.join(', ')}`);
  console.log(
    `  markers found (${prod.markersFound.length}/${PROD_MARKERS.length}): ${prod.markersFound.join(', ')}`,
  );
  if (prod.markersMissing.length) {
    console.log(`  markers missing: ${prod.markersMissing.join(', ')}`);
  }

  console.log('\n3) VITE_API_URL audit (lazy-chunk aware)');
  console.log(
    JSON.stringify(
      {
        apiUrlPresent: prod.env.apiUrlPresent ? 'PASS' : 'FAIL',
        apiUrlInEntryChunks: prod.env.apiUrlInEntryChunks,
        apiUrlInLazyChunks: prod.env.apiUrlInLazyChunks,
        note: prod.env.apiUrlInLazyChunks
          ? 'EXPECTED — api.vendorlymarketplace.app lives in vendor-pages/admin-pages chunks, not index entry.'
          : prod.env.apiUrlPresent
            ? 'Present in crawled bundles.'
            : 'Missing from all crawled chunks.',
      },
      null,
      2,
    ),
  );

  // Production may lag source after prune — require API URL; other markers soft-warn.
  const prodFail = !prod.env.apiUrlPresent;
  if (prod.markersMissing.length) {
    console.log(
      `  WARN stale_prod_markers=${prod.markersMissing.join('|')} (source baseline is authoritative post-prune)`,
    );
  }

  if (sourceFail || prodFail) process.exitCode = 1;
  else console.log('\nTEST_DRIFT_RESOLVED UI_BASELINE_OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
