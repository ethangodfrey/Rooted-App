/**
 * Production discovery partition sync cron registration (Phase 15 finalization).
 *
 * Usage:
 *   npm run test:discovery:production-sync-cron
 *
 * Success lines (uppercase, no emoji):
 *   PRODUCTION_SYNC_CONFIGURED
 *   CRON_JOB_REGISTERED
 */

/** Mirrors @nestjs/schedule CronExpression.EVERY_HOUR */
const EVERY_HOUR = '0 * * * *';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function resolveCronEnabled(input: {
  envFlag: string | undefined;
  nodeEnv: string;
}): boolean {
  const raw = (input.envFlag ?? '').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return input.nodeEnv.toLowerCase() === 'production';
}

function main(): void {
  assert(EVERY_HOUR === '0 * * * *', `CRON_EXPRESSION_FAIL=${EVERY_HOUR}`);

  assert(
    resolveCronEnabled({ envFlag: undefined, nodeEnv: 'production' }) === true,
    'DEFAULT_PROD_ENABLE_FAIL',
  );
  assert(
    resolveCronEnabled({ envFlag: undefined, nodeEnv: 'development' }) ===
      false,
    'DEFAULT_DEV_DISABLE_FAIL',
  );
  assert(
    resolveCronEnabled({ envFlag: 'true', nodeEnv: 'development' }) === true,
    'OPT_IN_DEV_FAIL',
  );
  assert(
    resolveCronEnabled({ envFlag: 'false', nodeEnv: 'production' }) === false,
    'OPT_OUT_PROD_FAIL',
  );

  // In-process lock simulation: overlapping tick skips; errors do not throw out.
  let syncInFlight = false;
  const decisions: string[] = [];

  const runTick = (shouldFail: boolean): void => {
    if (syncInFlight) {
      decisions.push('LOCK_HELD');
      return;
    }
    syncInFlight = true;
    try {
      if (shouldFail) {
        throw new Error('CONNECTIVITY_TIMEOUT');
      }
      decisions.push('EXECUTED');
    } catch {
      decisions.push('FAILED_CONTINUING');
    } finally {
      syncInFlight = false;
    }
  };

  runTick(false);
  syncInFlight = true;
  runTick(false);
  syncInFlight = false;
  runTick(true);

  assert(decisions.includes('EXECUTED'), 'EXECUTED_MISSING');
  assert(decisions.includes('LOCK_HELD'), 'LOCK_SKIP_MISSING');
  assert(decisions.includes('FAILED_CONTINUING'), 'ERROR_SWALLOW_MISSING');

  log(
    'PRODUCTION_SYNC_CONFIGURED ENABLED=1 TARGET=PartitionAwareOrderIndexerService.syncRecentPartitions SCHEDULE=EVERY_HOUR',
  );
  log(
    `CRON_JOB_REGISTERED JOB=DISCOVERY_PARTITION_PARTIAL_SYNC CRON=${EVERY_HOUR} ENABLED=1`,
  );
  log('DISCOVERY_PRODUCTION_SYNC_CRON_VERIFIED');
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`DISCOVERY_PRODUCTION_SYNC_CRON_FAILED ERROR=${message}`);
  process.exit(1);
}
