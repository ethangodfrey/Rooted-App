/**
 * Production Ingress Verification Utility (cutover).
 *
 * Confirms external DNS propagation and live routing alignment against the
 * production gateway hosts. Never accepts localhost / loopback targets.
 *
 * Usage:
 *   npm run verify:ingress
 *
 * Success lines (uppercase, no emoji):
 *   INGRESS_OK
 *   DNS_VERIFIED
 *   ROUTING_ALIGNED
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lookup, resolveCname } from 'node:dns/promises';

type IngressTargets = {
  BACKEND: {
    PUBLIC_HOST: string;
    PUBLIC_BASE_URL: string;
    HEALTH_PATH: string;
  };
  TENANT_WEB: {
    PUBLIC_HOST: string;
    PUBLIC_BASE_URL: string;
    READINESS_PATH: string;
  };
};

type ProbeOk = {
  OK: true;
  CODE: number;
  DETAIL: string;
  HEADERS: Record<string, string>;
};

type ProbeFail = {
  OK: false;
  CODE: number;
  DETAIL: string;
  HEADERS: Record<string, string>;
};

type ProbeResult = ProbeOk | ProbeFail;

function loadEnvFile(filePath: string, options?: { override?: boolean }): void {
  if (!existsSync(filePath)) return;
  const override = options?.override === true;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    if (override || !process.env[key]) process.env[key] = value;
  }
}

function log(message: string): void {
  console.log(message);
}

function fail(message: string): never {
  throw new Error(message);
}

function loadTargets(): IngressTargets {
  const path = resolve(process.cwd(), 'deploy/ingress.targets.json');
  if (!existsSync(path)) {
    fail('INGRESS_FAIL MISSING deploy/ingress.targets.json');
  }
  return JSON.parse(readFileSync(path, 'utf8')) as IngressTargets;
}

function assertRemoteUrl(url: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail(`INGRESS_FAIL INVALID_URL LABEL=${label} URL=${url}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost')
  ) {
    fail(`INGRESS_FAIL LOCAL_FALLBACK_REJECTED LABEL=${label} HOST=${host}`);
  }
  if (parsed.protocol !== 'https:') {
    fail(`INGRESS_FAIL HTTPS_REQUIRED LABEL=${label} URL=${url}`);
  }
  return parsed;
}

function headerMap(response: Response): Record<string, string> {
  const out: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function isHtmlBody(text: string, contentType: string): boolean {
  if (contentType.includes('text/html')) return true;
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function assertHealthSchema(json: unknown): string {
  if (!json || typeof json !== 'object') {
    return 'SCHEMA_NOT_OBJECT';
  }
  const body = json as Record<string, unknown>;
  const status = typeof body.STATUS === 'string' ? body.STATUS.toUpperCase() : '';
  if (status !== 'HEALTH_OK') {
    return `SCHEMA_STATUS_${status || 'MISSING'}`;
  }
  if (typeof body.TIMESTAMP !== 'number' || !Number.isFinite(body.TIMESTAMP)) {
    return 'SCHEMA_TIMESTAMP_INVALID';
  }
  return 'SCHEMA_HEALTH_OK';
}

function assertReadinessSchema(json: unknown): string {
  if (!json || typeof json !== 'object') {
    return 'SCHEMA_NOT_OBJECT';
  }
  const body = json as Record<string, unknown>;
  const status = typeof body.STATUS === 'string' ? body.STATUS.toUpperCase() : '';
  if (status !== 'HEALTH_OK') {
    return `SCHEMA_STATUS_${status || 'MISSING'}`;
  }
  if (typeof body.TIMESTAMP !== 'number' || !Number.isFinite(body.TIMESTAMP)) {
    return 'SCHEMA_TIMESTAMP_INVALID';
  }
  const checks = body.CHECKS;
  if (!checks || typeof checks !== 'object') {
    return 'SCHEMA_CHECKS_MISSING';
  }
  const c = checks as Record<string, unknown>;
  if (c.RUNTIME !== 'UP') {
    return 'SCHEMA_RUNTIME_NOT_UP';
  }
  if (c.ENV !== 'UP' && c.ENV !== 'DOWN') {
    return 'SCHEMA_ENV_INVALID';
  }
  if (c.ENV !== 'UP') {
    return 'SCHEMA_ENV_DOWN';
  }
  return 'SCHEMA_READINESS_OK';
}

async function probeEndpoint(
  url: string,
  kind: 'HEALTH' | 'READINESS',
): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      redirect: 'manual',
    });
    const headers = headerMap(response);
    const text = await response.text();
    const contentType = (headers['content-type'] || '').toLowerCase();

    if (response.status >= 300 && response.status < 400) {
      return {
        OK: false,
        CODE: response.status,
        DETAIL: `REDIRECT_${headers.location || 'UNKNOWN'}`,
        HEADERS: headers,
      };
    }

    if (isHtmlBody(text, contentType)) {
      return {
        OK: false,
        CODE: response.status,
        DETAIL: 'HTML_CATCHALL_REJECTED',
        HEADERS: headers,
      };
    }

    if (!contentType.includes('application/json') && !text.trimStart().startsWith('{')) {
      return {
        OK: false,
        CODE: response.status,
        DETAIL: `NON_JSON_CONTENT_TYPE=${contentType || 'EMPTY'}`,
        HEADERS: headers,
      };
    }

    if (response.status !== 200) {
      return {
        OK: false,
        CODE: response.status,
        DETAIL: `HTTP_${response.status}`,
        HEADERS: headers,
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        OK: false,
        CODE: response.status,
        DETAIL: 'JSON_PARSE_FAIL',
        HEADERS: headers,
      };
    }

    const schemaDetail =
      kind === 'HEALTH' ? assertHealthSchema(json) : assertReadinessSchema(json);
    if (!schemaDetail.endsWith('_OK')) {
      return {
        OK: false,
        CODE: response.status,
        DETAIL: schemaDetail,
        HEADERS: headers,
      };
    }

    return {
      OK: true,
      CODE: response.status,
      DETAIL: schemaDetail,
      HEADERS: headers,
    };
  } catch (err) {
    return {
      OK: false,
      CODE: 0,
      DETAIL: err instanceof Error ? err.message : 'NETWORK_ERROR',
      HEADERS: {},
    };
  }
}

async function verifyDns(host: string): Promise<boolean> {
  try {
    const results = await lookup(host, { all: true });
    if (!results.length) {
      log(`DNS_MISSING HOST=${host}`);
      return false;
    }
    const addrs = results.map((row) => row.address).join(',');
    log(`DNS_VERIFIED HOST=${host} ADDR=${addrs}`);

    try {
      const cnames = await resolveCname(host);
      if (cnames.length > 0) {
        log(`DNS_CNAME HOST=${host} TARGET=${cnames.join(',')}`);
      }
    } catch {
      // A/AAAA-only apex records are acceptable once lookup succeeds.
    }
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'DNS_ERROR';
    log(`DNS_MISSING HOST=${host} DETAIL=${detail}`);
    return false;
  }
}

function logHeaderSignals(headers: Record<string, string>, label: string): void {
  const contentType = headers['content-type'] || 'MISSING';
  const cacheControl = headers['cache-control'] || 'MISSING';
  const ingress = headers['x-vendorly-ingress'] || 'NONE';
  log(
    `HEADER_${label} CONTENT_TYPE=${contentType} CACHE_CONTROL=${cacheControl} X_VENDORLY_INGRESS=${ingress}`,
  );
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env'));
  const livePath = resolve(process.cwd(), '.env.live');
  const liveExamplePath = resolve(process.cwd(), '.env.live.example');
  // Prefer local .env.live; otherwise let .env.live.example override stale shell DEPLOY_*.
  if (existsSync(livePath)) {
    loadEnvFile(livePath, { override: true });
  } else {
    loadEnvFile(liveExamplePath, { override: true });
  }

  const targets = loadTargets();
  log('INGRESS_CUTOVER START');

  const healthUrl =
    process.env.DEPLOY_HEALTH_URL?.trim() ||
    `${targets.BACKEND.PUBLIC_BASE_URL}${targets.BACKEND.HEALTH_PATH}`;
  const readinessUrl =
    process.env.DEPLOY_READINESS_URL?.trim() ||
    `${targets.TENANT_WEB.PUBLIC_BASE_URL}${targets.TENANT_WEB.READINESS_PATH}`;

  const healthParsed = assertRemoteUrl(healthUrl, 'HEALTH');
  const readinessParsed = assertRemoteUrl(readinessUrl, 'READINESS');

  log(`INGRESS_BIND HEALTH=${healthUrl}`);
  log(`INGRESS_BIND READINESS=${readinessUrl}`);

  const dnsHealth = await verifyDns(healthParsed.hostname);
  const dnsReadiness = await verifyDns(readinessParsed.hostname);
  const dnsOk = dnsHealth && dnsReadiness;
  if (dnsOk) {
    log('DNS_VERIFIED');
  }

  const health = await probeEndpoint(healthUrl, 'HEALTH');
  logHeaderSignals(health.HEADERS, 'HEALTH');
  log(
    `PROBE HEALTH CODE=${health.CODE} OK=${health.OK ? 'YES' : 'NO'} DETAIL=${health.DETAIL}`,
  );
  if (health.OK) log('ROUTING_ALIGNED HEALTH');

  const readiness = await probeEndpoint(readinessUrl, 'READINESS');
  logHeaderSignals(readiness.HEADERS, 'READINESS');
  log(
    `PROBE READINESS CODE=${readiness.CODE} OK=${readiness.OK ? 'YES' : 'NO'} DETAIL=${readiness.DETAIL}`,
  );
  if (readiness.OK) log('ROUTING_ALIGNED READINESS');

  if (!dnsOk || !health.OK || !readiness.OK) {
    log('INGRESS_FAIL CUTOVER_NOT_ALIGNED');
    if (!dnsHealth) {
      log('INGRESS_HINT CNAME_api.vendorlymarketplace.app_TO_RAILWAY_SERVICE_DOMAIN');
    }
    if (!readiness.OK && readiness.DETAIL === 'HTML_CATCHALL_REJECTED') {
      log('INGRESS_HINT REDEPLOY_tenant-web_EXCLUDE_api_FROM_TENANT_MIDDLEWARE');
    }
    if (!readiness.OK && readiness.CODE === 404) {
      log('INGRESS_HINT READINESS_ROUTE_NOT_DEPLOYED');
    }
    process.exit(1);
  }

  log('ROUTING_ALIGNED');
  log('INGRESS_OK');
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`FAIL: ${message}`);
  process.exit(1);
});
