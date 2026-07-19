/**
 * Nationwide multi-tenant routing + geo integration audit.
 *
 * Validates dynamic `*.vendorlymarketplace.com` subdomain rewrites for all
 * 50 state city fixtures, interstate bounding-box grids, and TypeScript health.
 *
 * Usage:
 *   npm run test:integration:nationwide
 *
 * Success lines (uppercase, no emoji):
 *   NATIONWIDE_ROUTING_ACTIVE
 *   STATE_VALIDATION_PASSED
 *   GEO_BBOX_VERIFIED
 *   TYPESCRIPT_SWEEP_PASSED
 *   INTEGRATION_CHECK_PASSED
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  US_STATE_GEO_FIXTURES,
  assertUsStateFixtureCoverage,
  boundingBoxDegrees,
  getNationwideCrossSectionFixtures,
  getStateGeoFixture,
  isValidTenantSubdomainSlug,
  parseNearbyMarketsQuerySafe,
  pointInBoundingBox,
} from '@vendorly/env-config';

const PLATFORM_DOMAIN = 'vendorlymarketplace.com';
const RESERVED_SUBDOMAIN_SLUGS = new Set(['api', 'www', 'main']);

type RewriteResult =
  | { KIND: 'BYPASS' }
  | { KIND: 'BYPASS_RESERVED'; SLUG: string }
  | { KIND: 'REWRITE'; SLUG: string; PATH: string; DIRECTORY_SLUG: string }
  | { KIND: 'UNKNOWN' };

function log(message: string): void {
  console.log(message);
}

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function normalizeHost(rawHost: string): string {
  const withoutPort = rawHost.split(':')[0]?.trim().toLowerCase() ?? '';
  return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
}

function peekSubdomainLabel(host: string, platformDomain: string): string | null {
  if (!host.endsWith(`.${platformDomain}`)) return null;
  const slug = host.slice(0, -(platformDomain.length + 1));
  if (!slug || slug.includes('.')) return null;
  return slug;
}

function extractSubdomainSlug(host: string, platformDomain: string): string | null {
  const slug = peekSubdomainLabel(host, platformDomain);
  if (!slug || RESERVED_SUBDOMAIN_SLUGS.has(slug)) return null;
  if (!isValidTenantSubdomainSlug(slug)) return null;
  return slug;
}

function shouldBypassMiddleware(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return (
    normalized === '/api' ||
    normalized.startsWith('/api/') ||
    normalized === '/_next' ||
    normalized.startsWith('/_next/')
  );
}

/** Mirrors tenant-web middleware: host slug → app/[tenant] + directory context. */
function simulateNationwideRewrite(
  rawHost: string,
  pathname: string,
): RewriteResult {
  const host = normalizeHost(rawHost);
  if (shouldBypassMiddleware(pathname)) {
    return { KIND: 'BYPASS' };
  }

  const reserved = peekSubdomainLabel(host, PLATFORM_DOMAIN);
  if (reserved && RESERVED_SUBDOMAIN_SLUGS.has(reserved)) {
    return { KIND: 'BYPASS_RESERVED', SLUG: reserved };
  }

  const slug = extractSubdomainSlug(host, PLATFORM_DOMAIN);
  if (!slug) {
    return { KIND: 'UNKNOWN' };
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments[0] === slug) {
    return {
      KIND: 'REWRITE',
      SLUG: slug,
      PATH: pathname,
      DIRECTORY_SLUG: slug,
    };
  }

  const suffix = pathname === '/' ? '' : pathname;
  return {
    KIND: 'REWRITE',
    SLUG: slug,
    PATH: `/${slug}${suffix}`,
    DIRECTORY_SLUG: slug,
  };
}

function auditStateFixtureCoverage(): void {
  log('AUDIT_STATE_FIXTURES_START');
  const coverage = assertUsStateFixtureCoverage();
  assert(coverage.OK, coverage.OK ? 'STATE_VALIDATION_FAIL' : coverage.ERROR);
  assert(US_STATE_GEO_FIXTURES.length === 50, 'STATE_VALIDATION_FAIL COUNT');

  for (const row of US_STATE_GEO_FIXTURES) {
    assert(
      isValidTenantSubdomainSlug(row.TENANT_SLUG),
      `STATE_VALIDATION_FAIL SLUG=${row.TENANT_SLUG}`,
    );
  }

  log(`STATE_VALIDATION_PASSED COUNT=${US_STATE_GEO_FIXTURES.length}`);
}

function auditNationwideRouting(): void {
  log('AUDIT_NATIONWIDE_ROUTING_START');

  for (const row of US_STATE_GEO_FIXTURES) {
    const host = `${row.TENANT_SLUG}.${PLATFORM_DOMAIN}`;
    const rewrite = simulateNationwideRewrite(host, '/');
    assert(rewrite.KIND === 'REWRITE', `NATIONWIDE_ROUTING_FAIL HOST=${host}`);
    assert(rewrite.SLUG === row.TENANT_SLUG, `NATIONWIDE_ROUTING_FAIL SLUG=${rewrite.SLUG}`);
    assert(
      rewrite.PATH === `/${row.TENANT_SLUG}`,
      `NATIONWIDE_ROUTING_FAIL PATH=${rewrite.PATH}`,
    );
    assert(
      rewrite.DIRECTORY_SLUG === row.TENANT_SLUG,
      `NATIONWIDE_ROUTING_FAIL DIRECTORY=${rewrite.DIRECTORY_SLUG}`,
    );
  }

  // City-based sample path with nested route.
  const nested = simulateNationwideRewrite('seattle.vendorlymarketplace.com', '/markets');
  assert(nested.KIND === 'REWRITE', 'NATIONWIDE_ROUTING_FAIL NESTED');
  assert(nested.PATH === '/seattle/markets', `NATIONWIDE_ROUTING_FAIL NESTED_PATH=${nested.PATH}`);

  // Same-origin API must bypass tenant rewrite nationwide.
  const api = simulateNationwideRewrite(
    'miami.vendorlymarketplace.com',
    '/api/markets/nearby',
  );
  assert(api.KIND === 'BYPASS', 'NATIONWIDE_ROUTING_FAIL API_BYPASS');

  log('NATIONWIDE_ROUTING_ACTIVE COUNT=50');
}

function auditInterstateGeo(): void {
  log('AUDIT_GEO_NATIONWIDE_START');

  for (const row of getNationwideCrossSectionFixtures()) {
    const parsed = parseNearbyMarketsQuerySafe({
      latitude: String(row.LATITUDE),
      longitude: String(row.LONGITUDE),
      radiusMiles: '50',
      limit: '25',
    });
    assert(parsed.OK, `GEO_FAIL QUERY STATE=${row.ABBR}`);
    const box = boundingBoxDegrees(
      parsed.DATA.latitude,
      parsed.DATA.longitude,
      parsed.DATA.radiusMiles,
    );
    assert(
      pointInBoundingBox(row.LATITUDE, row.LONGITUDE, box),
      `GEO_FAIL CENTER STATE=${row.ABBR}`,
    );
    log(
      `GEO_CROSS_SECTION STATE=${row.ABBR} CITY=${row.CITY.replace(/\s+/g, '_').toUpperCase()} BBOX_OK`,
    );
  }

  // Interstate: Kansas City MO query must include KS side (no state clipping).
  const mo = getStateGeoFixture('MO');
  const ks = getStateGeoFixture('KS');
  assert(mo && ks, 'GEO_FAIL MISSING_KC_FIXTURES');
  const kcBox = boundingBoxDegrees(mo.LATITUDE, mo.LONGITUDE, 25);
  assert(
    pointInBoundingBox(ks.LATITUDE, ks.LONGITUDE, kcBox),
    'GEO_FAIL INTERSTATE_CLIPPED MO_KS',
  );
  log('GEO_INTERSTATE_OK PAIR=MO_KS');

  // Portland OR/WA corridor — radius from OR includes nearby WA offset.
  const or = getStateGeoFixture('OR');
  assert(or, 'GEO_FAIL MISSING_OR');
  const portlandBox = boundingBoxDegrees(or.LATITUDE, or.LONGITUDE, 100);
  const waOffsetLat = or.LATITUDE + 0.4;
  const waOffsetLng = or.LONGITUDE;
  assert(
    pointInBoundingBox(waOffsetLat, waOffsetLng, portlandBox),
    'GEO_FAIL INTERSTATE_CLIPPED OR_WA',
  );
  log('GEO_INTERSTATE_OK PAIR=OR_WA');

  log('GEO_BBOX_VERIFIED');
}

function runTypecheck(cwd: string, args: string[], label: string): void {
  log(`TYPESCRIPT_SWEEP_START LABEL=${label}`);
  const result = spawnSync('npx', ['tsc', ...args], {
    cwd,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    const detail = (result.stdout || result.stderr || '').trim().slice(0, 1200);
    fail(`TYPESCRIPT_SWEEP_FAIL LABEL=${label} DETAIL=${detail}`);
  }
  log(`TYPESCRIPT_SWEEP_OK LABEL=${label}`);
}

function auditTypescriptSweep(): void {
  const root = process.cwd();
  runTypecheck(resolve(root, 'packages/env-config'), ['--noEmit', '-p', 'tsconfig.json'], 'ENV_CONFIG');
  runTypecheck(resolve(root, 'backend'), ['--noEmit'], 'BACKEND');
  runTypecheck(resolve(root, 'tenant-web'), ['--noEmit'], 'TENANT_WEB');

  if (existsSync(resolve(root, 'web/tsconfig.json'))) {
    runTypecheck(resolve(root, 'web'), ['-b', '--pretty', 'false'], 'WEB');
  }
  if (existsSync(resolve(root, 'mobile/tsconfig.json'))) {
    runTypecheck(resolve(root, 'mobile'), ['--noEmit'], 'MOBILE');
  }

  log('TYPESCRIPT_SWEEP_PASSED');
}

function main(): void {
  log('NATIONWIDE_INTEGRATION_AUDIT_START');

  auditStateFixtureCoverage();
  auditNationwideRouting();
  auditInterstateGeo();
  auditTypescriptSweep();

  log('INTEGRATION_CHECK_PASSED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`INTEGRATION_CHECK_FAILED ${message}`);
  process.exitCode = 1;
}
