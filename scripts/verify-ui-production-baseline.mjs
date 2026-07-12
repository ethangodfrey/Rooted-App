#!/usr/bin/env node
/**
 * Sanity-check active web source tree against confirmed production bundle markers.
 *
 * Usage:
 *   node scripts/verify-ui-production-baseline.mjs
 *   node scripts/verify-ui-production-baseline.mjs --url=https://vendorly-marketplace1.vercel.app
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { auditProductionEnv, crawlProductionChunks, findMarkers } from './lib/bundle-chunk-audit.mjs';

const PROD_URL = 'https://vendorly-marketplace1.vercel.app';
const WEB_SRC = join('web', 'src');

const BASELINE = {
  dashboardStyles: [
    {
      id: 'vendor-hero-gradient',
      pattern: 'bg-gradient-to-tr from-orange-600',
      files: ['web/src/components/vendor/vendor-ui.tsx'],
    },
  ],
  ledgerElements: [
    { id: 'pos-transactions-lib', pattern: 'pos_transactions', files: ['web/src/lib/pos-transactions.ts'] },
    { id: 'pos-transactions-channel', pattern: "table: 'pos_transactions'", files: ['web/src/lib/pos-transactions.ts'] },
    { id: 'use-pos-ledger-hook', pattern: 'usePosLedger', files: ['web/src/hooks/use-pos-ledger.ts'] },
    { id: 'connect-pos-cta', pattern: 'Connect POS', files: ['web/src/pages/vendor/VendorDashboardPage.tsx', 'web/src/pages/vendor/VendorAnalyticsPage.tsx'] },
    { id: 'platform-fees-kpi', pattern: 'Platform fees', files: ['web/src/pages/vendor/VendorDashboardPage.tsx'] },
    { id: 'waiting-first-sale', pattern: 'waiting for your first card sale', files: ['web/src/pages/vendor/VendorDashboardPage.tsx', 'web/src/pages/vendor/VendorAnalyticsPage.tsx'] },
  ],
  settlementMetrics: [
    { id: 'gross-volume-trend', pattern: 'Gross volume trend', files: ['web/src/components/vendor/SettlementDashboard.tsx'] },
    { id: 'platform-fee-split', pattern: 'Platform fee split', files: ['web/src/components/vendor/SettlementDashboard.tsx'] },
    { id: 'market-settlement', pattern: 'Market settlement', files: ['web/src/pages/vendor/VendorAnalyticsPage.tsx'] },
  ],
};

const PROD_MARKERS = [
  'bg-gradient-to-tr from-orange-600',
  'Connect POS',
  'Platform fees',
  'waiting for your first card sale',
  'pos-transactions',
  'Gross volume trend',
  'Platform fee split',
  'Market settlement',
  'api.vendorly.app',
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
  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  const url = urlArg?.slice('--url='.length) ?? PROD_URL;

  console.log('=== UI / production baseline sanity check ===\n');

  console.log('1) Source tree baseline');
  const source = scanSourceBaseline();
  for (const row of source) {
    console.log(`  [${row.status}] ${row.group}/${row.id}`);
    if (row.status === 'FAIL') console.log(`       missing: ${row.missingFiles.join(', ')}`);
  }

  console.log('\n2) Production bundle crawl (lazy chunks included)');
  const prod = await scanProductionBaseline(url);
  console.log(`  chunks: ${prod.chunkPaths.join(', ')}`);
  console.log(`  markers found (${prod.markersFound.length}/${PROD_MARKERS.length}): ${prod.markersFound.join(', ')}`);
  if (prod.markersMissing.length) {
    console.log(`  markers missing: ${prod.markersMissing.join(', ')}`);
  }

  console.log('\n3) VITE_API_URL audit (lazy-chunk aware)');
  console.log(JSON.stringify({
    apiUrlPresent: prod.env.apiUrlPresent ? 'PASS' : 'FAIL',
    apiUrlInEntryChunks: prod.env.apiUrlInEntryChunks,
    apiUrlInLazyChunks: prod.env.apiUrlInLazyChunks,
    note: prod.env.apiUrlInLazyChunks
      ? 'EXPECTED — api.vendorly.app lives in vendor-pages/admin-pages chunks, not index entry.'
      : prod.env.apiUrlPresent
        ? 'Present in crawled bundles.'
        : 'Missing from all crawled chunks.',
  }, null, 2));

  const sourceFail = source.some((r) => r.status === 'FAIL');
  const prodFail = prod.markersMissing.length > 0 || !prod.env.apiUrlPresent;

  if (sourceFail || prodFail) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
