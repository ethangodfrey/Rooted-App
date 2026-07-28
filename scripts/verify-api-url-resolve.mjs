/**
 * Smoke checks for tenant-web API URL resolution rules.
 * Run: node scripts/verify-api-url-resolve.mjs
 */
import assert from 'node:assert/strict';

const RAILWAY = 'https://rooted-app-production-43fb.up.railway.app';

function isLoopbackHostname(hostname) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isLoopbackApiUrl(url) {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isDeployedRuntime(env) {
  if (env.VERCEL === '1' || env.VERCEL === 'true') return true;
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return true;
  return env.NODE_ENV === 'production';
}

function firstConfiguredApiUrl(env) {
  for (const key of [
    'TENANT_API_URL',
    'NEXT_PUBLIC_API_URL',
    'VITE_API_URL',
    'PUBLIC_API_URL',
    'API_URL',
  ]) {
    const value = env[key]?.trim();
    if (value) return { url: value.replace(/\/$/, ''), source: key };
  }
  return null;
}

function normalizeConfiguredApiUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'api.vendorlymarketplace.app' || host === 'api.vendorly.app') {
      return RAILWAY;
    }
  } catch {
    /* keep */
  }
  return url;
}

function resolveApiBaseUrl(env) {
  const deployed = isDeployedRuntime(env);
  const configured = firstConfiguredApiUrl(env);
  let base = configured?.url ?? '';

  if (base && isLoopbackApiUrl(base) && deployed) {
    base = RAILWAY;
  }
  if (!base) {
    base = deployed ? RAILWAY : 'http://localhost:4000';
  }
  return normalizeConfiguredApiUrl(base).replace(/\/$/, '');
}

assert.equal(
  resolveApiBaseUrl({ NODE_ENV: 'development' }),
  'http://localhost:4000',
  'DEV_DEFAULT',
);

assert.equal(
  resolveApiBaseUrl({ NODE_ENV: 'production' }),
  RAILWAY,
  'PROD_FALLBACK',
);

assert.equal(
  resolveApiBaseUrl({
    VERCEL: '1',
    TENANT_API_URL: 'http://127.0.0.1:4000',
  }),
  RAILWAY,
  'LOCALHOST_FETCH_ELIMINATED',
);

assert.equal(
  resolveApiBaseUrl({
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_API_URL: 'https://rooted-app-production-43fb.up.railway.app/',
  }),
  RAILWAY,
  'NEXT_PUBLIC_API_URL',
);

assert.equal(
  resolveApiBaseUrl({
    VERCEL: '1',
    VITE_API_URL: 'https://api.vendorlymarketplace.app',
  }),
  RAILWAY,
  'DNS_FALLBACK',
);

assert.equal(
  resolveApiBaseUrl({
    NODE_ENV: 'development',
    TENANT_API_URL: 'http://localhost:4000',
  }),
  'http://localhost:4000',
  'DEV_ALLOWS_LOOPBACK',
);

console.log('API_URL_RESOLVED VERIFY_OK');
console.log('LOCALHOST_FETCH_ELIMINATED VERIFY_OK');
