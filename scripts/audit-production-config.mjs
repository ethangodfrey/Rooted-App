#!/usr/bin/env node
/**
 * Read-only production configuration audit for backend + web env templates.
 * Does not load secrets — validates documented production targets only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readExample(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

const backendExample = readExample('backend/.env.example');
const webExample = readExample('web/.env.example');

const checks = [
  {
    name: 'Backend PUBLIC_BASE_URL production target',
    ok: /PUBLIC_BASE_URL=https:\/\/api\.vendorly\.app/.test(backendExample),
  },
  {
    name: 'Backend CORS documents vendorly.app origins',
    ok: /CORS_ORIGINS=.*vendorly\.app/.test(backendExample),
  },
  {
    name: 'Web VITE_API_URL production example',
    ok: /VITE_API_URL=https:\/\/api\.vendorly\.app/.test(webExample),
  },
  {
    name: 'Web dev localhost API example preserved',
    ok: /VITE_API_URL=http:\/\/localhost:4000/.test(webExample),
  },
];

let failed = 0;
for (const check of checks) {
  const status = check.ok ? 'ok' : 'FAIL';
  console.log(`[audit-production-config] ${status}: ${check.name}`);
  if (!check.ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n[audit-production-config] ${failed} check(s) failed.`);
  process.exit(1);
}

console.log('\n[audit-production-config] All template checks passed.');
