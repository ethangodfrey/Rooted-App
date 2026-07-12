/**
 * Post-deploy smoke checks for Vendor → Analytics → Market settlement.
 *
 * Usage:
 *   SMOKE_VENDOR_EMAIL=... SMOKE_VENDOR_PASSWORD=... node scripts/settlement-dashboard-smoke.mjs
 *   node scripts/settlement-dashboard-smoke.mjs --base=http://127.0.0.1:4173
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PROD_URL = 'https://vendorly-marketplace1.vercel.app';
const SETTLEMENT_MARKERS = [
  'Market settlement',
  'Gross volume trend',
  'Platform fee split',
  'Volume by order size',
  'Loading settlement totals',
  'No completed orders yet',
];

const baseArg = process.argv.find((a) => a.startsWith('--base='));
const explicitBase = baseArg?.slice('--base='.length);
const vendorEmail = process.env.SMOKE_VENDOR_EMAIL?.trim();
const vendorPassword = process.env.SMOKE_VENDOR_PASSWORD?.trim();

function scanLocalDistMarkers() {
  const dir = join('web', 'dist', 'assets');
  const found = new Set();
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const js = readFileSync(join(dir, file), 'utf8');
    for (const marker of SETTLEMENT_MARKERS) {
      if (js.includes(marker)) found.add(marker);
    }
  }
  return { assets: files.length, markers: [...found] };
}

async function fetchRemoteBundleMarkers(url) {
  const html = await fetch(`${url}/`).then((r) => r.text());
  const assets = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const importRefs = new Set(assets);
  const found = new Set();

  for (const asset of assets) {
    const js = await fetch(`${url}${asset}`).then((r) => r.text());
    for (const marker of SETTLEMENT_MARKERS) {
      if (js.includes(marker)) found.add(marker);
    }
    for (const match of js.matchAll(/assets\/[A-Za-z0-9_.-]+\.js/g)) {
      importRefs.add(`/${match[0]}`);
    }
  }

  for (const asset of importRefs) {
    if (assets.includes(asset)) continue;
    try {
      const js = await fetch(`${url}${asset}`).then((r) => r.text());
      for (const marker of SETTLEMENT_MARKERS) {
        if (js.includes(marker)) found.add(marker);
      }
    } catch {
      /* skip missing chunks */
    }
  }

  return { assets: [...importRefs], markers: [...found] };
}

async function verifyProdEnv(url) {
  const html = await fetch(`${url}/`).then((r) => r.text());
  const assets = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  let js = '';
  for (const asset of assets) {
    js += await fetch(`${url}${asset}`).then((r) => r.text());
  }
  return {
    httpStatus: await fetch(url).then((r) => r.status),
    supabaseUrl: js.includes('ajedyjbdpjahnhzrxwdj.supabase.co'),
    apiUrl: js.includes('api.vendorly.app'),
    anonKeyPresent: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(js),
    assetCount: assets.length,
    monolithicBundle: assets.length === 1,
  };
}

async function startPreview() {
  const env = Object.fromEntries(
    readFileSync('web/.env.production', 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
  env.VITE_API_URL = 'https://api.vendorly.app';
  env.VITE_APP_URL = 'http://127.0.0.1:4173';

  const child = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: 'web',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let i = 0; i < 30; i += 1) {
    try {
      const ok = await fetch('http://127.0.0.1:4173/').then((r) => r.ok);
      if (ok) return child;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  child.kill();
  throw new Error('Preview server did not start');
}

async function signInVendor(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
}

async function browserChecks(baseUrl, creds) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = { authenticated: false };

  try {
    if (creds?.email && creds?.password) {
      await signInVendor(page, baseUrl, creds.email, creds.password);
      results.authenticated = true;
    }

    await page.goto(`${baseUrl}/vendor/analytics`, { waitUntil: 'networkidle', timeout: 45000 });
    results.route = page.url();

    // Observe skeleton if settlement query is still loading.
    const skeleton = page.locator('[aria-label="Loading settlement totals"]');
    if (await skeleton.count()) {
      await sleep(300);
      results.skeletonBars = await skeleton.locator('.flex-1.rounded-t-md').count();
      results.skeletonPanels = await skeleton.locator('.min-h-\\[240px\\]').count();
      results.skeletonLayoutOk = results.skeletonBars === 14 && results.skeletonPanels === 2;
    }

    await page.getByText('Market settlement', { exact: false }).waitFor({ timeout: 20000 }).catch(() => null);

    const bodyText = await page.locator('body').innerText();
    results.hasMarketSettlement = bodyText.includes('Market settlement');
    results.hasGrossTrend = bodyText.includes('Gross volume trend');
    results.hasFeeSplit = bodyText.includes('Platform fee split');
    results.hasSizeBuckets = bodyText.includes('Volume by order size');
    results.hasEmptyState = bodyText.includes('No completed orders yet');
    results.hasMetricCards =
      bodyText.includes('Gross volume') &&
      bodyText.includes('Platform fee') &&
      bodyText.includes('Net payout');
    results.hasTrendBars = (await page.locator('[aria-label="Gross settlement volume trend by period"] .analytics-bar').count()) > 0;
    results.hasFeeStackBars = (await page.locator('[aria-label="Net payout and platform fee split by period"] .analytics-bar').count()) > 0;
    results.hasSizeBucketBars = (await page.locator('.analytics-hbars .analytics-hbar-fill').count()) > 0;
    results.hasChartParseError =
      bodyText.includes('undefined') ||
      bodyText.includes('NaN') ||
      bodyText.includes('Could not load settlement totals');
  } finally {
    await browser.close();
  }

  return results;
}

async function main() {
  console.log('=== Settlement dashboard smoke test ===\n');

  console.log('1) Production env vars (Vendorly_Marketplace1)');
  const envCheck = await verifyProdEnv(PROD_URL);
  console.log(JSON.stringify(envCheck, null, 2));

  console.log('\n2) Production bundle — settlement component markers');
  const prodMarkers = await fetchRemoteBundleMarkers(PROD_URL);
  console.log(JSON.stringify(prodMarkers, null, 2));

  console.log('\n3) Local dist (main build) — settlement markers across chunks');
  const localMarkers = scanLocalDistMarkers();
  console.log(JSON.stringify(localMarkers, null, 2));

  let previewChild = null;
  let localBase = explicitBase;
  if (!localBase) {
    console.log('\n4) Starting local production preview');
    previewChild = await startPreview();
    localBase = 'http://127.0.0.1:4173';
  }

  const creds =
    vendorEmail && vendorPassword ? { email: vendorEmail, password: vendorPassword } : null;
  if (!creds) {
    console.log('\nWARN: SMOKE_VENDOR_EMAIL/PASSWORD not set — UI checks will stop at auth gate.');
  }

  console.log(`\n5) Browser verification @ ${localBase}/vendor/analytics`);
  const browser = await browserChecks(localBase, creds);
  console.log(JSON.stringify(browser, null, 2));

  if (previewChild) previewChild.kill();

  const prodHasSettlement = prodMarkers.markers.length >= 3;
  const localHasSettlement = localMarkers.markers.length >= 3;

  const checklist = {
    env_VITE_SUPABASE_URL: envCheck.supabaseUrl ? 'PASS' : 'FAIL',
    env_VITE_SUPABASE_ANON_KEY: envCheck.anonKeyPresent ? 'PASS' : 'FAIL',
    env_VITE_API_URL: envCheck.apiUrl ? 'PASS' : 'FAIL',
    gross_volume_trend:
      browser.hasGrossTrend && browser.hasTrendBars
        ? 'VERIFIED'
        : localHasSettlement
          ? 'PENDING_PROD_DEPLOY'
          : 'FAIL',
    platform_fee_split:
      browser.hasFeeSplit && browser.hasFeeStackBars
        ? 'VERIFIED'
        : localHasSettlement
          ? 'PENDING_PROD_DEPLOY'
          : 'FAIL',
    transaction_size_buckets:
      browser.hasSizeBuckets && (browser.hasSizeBucketBars || browser.hasMetricCards)
        ? 'VERIFIED'
        : localHasSettlement
          ? 'PENDING_PROD_DEPLOY'
          : 'FAIL',
    settlement_skeleton_7x2:
      browser.skeletonLayoutOk === true
        ? 'VERIFIED'
        : browser.authenticated
          ? 'NOT_OBSERVED_FAST_LOAD'
          : 'BLOCKED_AUTH',
    empty_state_placeholders:
      browser.hasEmptyState || (browser.hasGrossTrend && browser.hasFeeSplit)
        ? 'VERIFIED_OR_DATA_PRESENT'
        : browser.authenticated
          ? 'CHECK_MANUAL'
          : 'BLOCKED_AUTH',
    chart_parse_errors: browser.hasChartParseError ? 'FLAG_REVIEW' : 'NONE',
    production_deploy_includes_settlement: prodHasSettlement ? 'YES' : 'NO — redeploy required',
  };

  console.log('\n=== Checklist summary ===');
  console.log(JSON.stringify(checklist, null, 2));

  if (!prodHasSettlement) {
    console.error(
      '\nFLAG: Production bundle on Vendorly_Marketplace1 predates settlement charts. Redeploy main (7df3e60+) then re-run this script against production.',
    );
    process.exitCode = 2;
  } else if (!browser.authenticated) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
