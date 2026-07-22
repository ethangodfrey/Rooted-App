/**
 * Full-stack Phase 4–9 verification runner.
 *
 * Usage:
 *   npm test
 *   npm run test:full-stack
 *
 * Success lines (uppercase, no emoji):
 *   FULL_STACK_VERIFICATION_INITIALIZED
 *   FULL_STACK_VERIFIED
 *   PLATFORM_READY_FOR_STAGING
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function log(message: string): void {
  console.log(message);
}

function run(label: string, command: string, args: string[]): void {
  log(`SUITE_START ${label}`);
  const result = spawnSync(command, args, {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`SUITE_FAILED ${label} EXIT=${result.status ?? 'null'}`);
  }
  log(`SUITE_PASS ${label}`);
}

function main(): void {
  log('FULL_STACK_VERIFICATION_INITIALIZED');

  const suites: Array<[string, string[]]> = [
    ['FINANCIAL_CLEARING', ['run', 'test:financial:clearing']],
    ['FINANCIAL_UI', ['run', 'test:financial:ui']],
    ['LOGISTICS_FULFILLMENT', ['run', 'test:logistics:fulfillment']],
    ['LOGISTICS_UI', ['run', 'test:logistics:ui']],
    ['PAYMENTS_STRIPE', ['run', 'test:payments:stripe']],
    ['PAYMENTS_UI', ['run', 'test:payments:ui']],
    ['ADMIN_DASHBOARD', ['run', 'test:admin:dashboard']],
    ['ADMIN_DISPUTES', ['run', 'test:admin:disputes']],
    ['NOTIFICATIONS_ENGINE', ['run', 'test:notifications:engine']],
    ['PHASE83_AMEND', ['run', 'test:phase83:amend']],
  ];

  for (const [label, args] of suites) {
    run(label, 'npm', args);
  }

  log('FULL_STACK_VERIFIED');
  log('PLATFORM_READY_FOR_STAGING');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FULL_STACK_VERIFICATION_FAILED ${message}`);
  process.exitCode = 1;
}
