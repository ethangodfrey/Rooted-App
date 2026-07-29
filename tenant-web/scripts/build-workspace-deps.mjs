#!/usr/bin/env node
/**
 * Ensure file: workspace packages are compiled before `next build`.
 * Vercel Root Directory is typically tenant-web/, so paths are relative to this app.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const envConfigDir = path.join(repoRoot, 'packages', 'env-config');
const distEntry = path.join(envConfigDir, 'dist', 'index.js');

// eslint-disable-next-line no-console
console.log('VERCEL_BUILD_SCRIPT_UPDATED');
// eslint-disable-next-line no-console
console.log('WORKSPACE_BUILD_ORDER_FIXED TARGET=@vendorly/env-config');

if (!fs.existsSync(path.join(envConfigDir, 'package.json'))) {
  // eslint-disable-next-line no-console
  console.error(
    `WORKSPACE_BUILD_ORDER_FIXED FAIL MISSING_PACKAGE PATH=${envConfigDir}`,
  );
  // eslint-disable-next-line no-console
  console.error(
    'Set Vercel Root Directory to the repository root, or enable including files outside the Root Directory so packages/env-config is present.',
  );
  process.exit(1);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Install env-config deps when missing (fresh Vercel/npm ci of tenant-web alone).
const envConfigNodeModules = path.join(envConfigDir, 'node_modules');
if (!fs.existsSync(envConfigNodeModules)) {
  // eslint-disable-next-line no-console
  console.log('WORKSPACE_BUILD_ORDER_FIXED ACTION=NPM_CI PACKAGE=env-config');
  run('npm', ['ci'], envConfigDir);
}

// eslint-disable-next-line no-console
console.log('WORKSPACE_BUILD_ORDER_FIXED ACTION=BUILD PACKAGE=env-config');
run('npm', ['run', 'build'], envConfigDir);

if (!fs.existsSync(distEntry)) {
  // eslint-disable-next-line no-console
  console.error(
    `WORKSPACE_BUILD_ORDER_FIXED FAIL DIST_MISSING PATH=${distEntry}`,
  );
  process.exit(1);
}

// When npm copied the file: package (not a symlink), refresh so dist is present.
const linkedDist = path.join(
  appRoot,
  'node_modules',
  '@vendorly',
  'env-config',
  'dist',
  'index.js',
);
const linkedPkg = path.join(appRoot, 'node_modules', '@vendorly', 'env-config');
if (fs.existsSync(linkedPkg) && !fs.existsSync(linkedDist)) {
  // eslint-disable-next-line no-console
  console.log('WORKSPACE_BUILD_ORDER_FIXED ACTION=RELINK file:@vendorly/env-config');
  run(
    'npm',
    ['install', '--no-save', '--no-audit', '--no-fund', 'file:../packages/env-config'],
    appRoot,
  );
}

// eslint-disable-next-line no-console
console.log(`WORKSPACE_BUILD_ORDER_FIXED OK DIST=${distEntry}`);
