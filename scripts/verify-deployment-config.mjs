#!/usr/bin/env node
/**
 * Static checks that production deploy config files are present and coherent.
 * Emits uppercase monospaced markers for CI / Railway readiness gates.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function mustExist(rel) {
  const ok = existsSync(resolve(root, rel));
  console.log(ok ? `OK_EXISTS ${rel}` : `MISSING ${rel}`);
  return ok;
}

function mustMatch(rel, pattern, label) {
  const text = read(rel);
  const ok = pattern.test(text);
  console.log(ok ? `OK_MATCH ${label}` : `FAIL_MATCH ${label}`);
  return ok;
}

const checks = [
  mustExist('backend/Procfile'),
  mustExist('backend/railway.toml'),
  mustExist('backend/railway.json'),
  mustExist('backend/Dockerfile'),
  mustMatch(
    'backend/Procfile',
    /web:\s*npm run start:prod/,
    'Procfile start:prod',
  ),
  mustMatch(
    'backend/package.json',
    /"start:prod"\s*:\s*"node dist\/main\.js"/,
    'package.json start:prod',
  ),
  mustMatch(
    'backend/package.json',
    /"build"\s*:\s*"nest build"/,
    'package.json nest build',
  ),
  mustMatch(
    'backend/src/main.ts',
    /process\.env\.PORT/,
    'main.ts binds process.env.PORT',
  ),
  mustMatch(
    'backend/src/main.ts',
    /app\.listen\(port,\s*'0\.0\.0\.0'\)/,
    'main.ts listen 0.0.0.0',
  ),
  mustMatch(
    'backend/Dockerfile',
    /CMD\s*\[\s*"npm",\s*"run",\s*"start:prod"\s*\]/,
    'Dockerfile CMD start:prod',
  ),
  mustMatch(
    'backend/railway.toml',
    /dockerfilePath\s*=\s*"backend\/Dockerfile"/,
    'railway.toml dockerfilePath',
  ),
  mustMatch(
    'web/src/lib/api-url.ts',
    /RAILWAY_PUBLIC_API_URL/,
    'web api-url Railway fallback',
  ),
  mustMatch(
    'web/src/lib/api-url.ts',
    /isProductionRuntime|import\.meta\.env\.PROD/,
    'web api-url production switch',
  ),
  mustMatch(
    'tenant-web/next.config.ts',
    /remotePatterns/,
    'tenant-web images.remotePatterns',
  ),
  mustMatch(
    'tenant-web/next.config.ts',
    /image\.mux\.com|mux\.com/,
    'tenant-web Mux image host',
  ),
  mustMatch(
    'tenant-web/next.config.ts',
    /amazonaws\.com/,
    'tenant-web S3 image host',
  ),
  mustMatch(
    'tenant-web/src/lib/tenant/resolve-host.ts',
    /NODE_ENV === ['"]production['"]/,
    'tenant-web production API fallback',
  ),
];

const failed = checks.filter((ok) => !ok).length;

if (failed > 0) {
  console.error(`DEPLOYMENT_CONFIG_FAILED COUNT=${failed}`);
  process.exit(1);
}

console.log('DEPLOYMENT_CONFIG_GENERATED');
console.log('READY_FOR_RAILWAY');
