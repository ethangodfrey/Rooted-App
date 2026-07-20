/**
 * Health suite module 3 — Automation Reliability (scheduler lock + last-run).
 *
 * Usage:
 *   npm run test:health:scheduler-reliability
 *
 * Success lines:
 *   HEALTH_TEST_STARTED
 *   PERFORMANCE_METRICS_VALIDATED
 */

import { PartitionAwareSchedulerController } from '../backend/src/modules/search/partition-aware-scheduler-reliability.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  log('HEALTH_TEST_STARTED MODULE=SCHEDULER_RELIABILITY');

  let activeSyncs = 0;
  let maxConcurrent = 0;
  let syncCalls = 0;

  const controller = new PartitionAwareSchedulerController(
    {
      syncRecentPartitions: async () => {
        syncCalls += 1;
        activeSyncs += 1;
        maxConcurrent = Math.max(maxConcurrent, activeSyncs);
        await delay(40);
        activeSyncs -= 1;
        return {
          PARTITIONS_SCANNED: 3,
          DOCUMENTS_INDEXED: 12,
          SKIPPED_REASON: null,
        };
      },
    },
    true,
  );

  const first = controller.triggerSync();
  const overlapping = controller.triggerSync();
  const [statusA, statusB] = await Promise.all([first, overlapping]);

  assert(statusA.SUCCESS === true, 'FIRST_RUN_SUCCESS_FAIL');
  assert(statusA.SKIPPED_REASON === null, 'FIRST_RUN_SKIP_FAIL');
  assert(statusA.PARTITIONS_SCANNED === 3, 'PARTITIONS_FAIL');
  assert(statusA.DOCUMENTS_INDEXED === 12, 'INDEXED_FAIL');
  assert(statusA.FINISHED_AT != null, 'FINISHED_AT_FAIL');

  assert(
    statusB.SKIPPED_REASON === 'LOCK_HELD',
    `OVERLAP_LOCK_FAIL SKIPPED=${statusB.SKIPPED_REASON}`,
  );
  // Exactly one sync body should have run while the lock was held for the peer.
  const callsAfterOverlap = syncCalls;
  if (callsAfterOverlap !== 1) {
    throw new Error(`LOCK_OVERLAP_FAIL SYNC_CALLS=${callsAfterOverlap}`);
  }
  if (maxConcurrent !== 1) {
    throw new Error(`CONCURRENCY_FAIL MAX=${maxConcurrent}`);
  }

  const lastRun = controller.getLastRunStatus();
  assert(lastRun.SUCCESS === true, 'LAST_RUN_SUCCESS_FAIL');
  assert(lastRun.ERROR === null, 'LAST_RUN_ERROR_FAIL');
  assert(lastRun.STARTED_AT != null, 'LAST_RUN_STARTED_FAIL');

  // Second sequential run must also succeed and refresh last-run.
  const sequential = await controller.triggerSync();
  assert(sequential.SUCCESS === true, 'SEQUENTIAL_SUCCESS_FAIL');
  const callsAfterSequential = syncCalls;
  if (callsAfterSequential !== 2) {
    throw new Error(`SEQUENTIAL_CALLS_FAIL=${callsAfterSequential}`);
  }

  log(
    `SCHEDULER_LAST_RUN SUCCESS=${lastRun.SUCCESS ? '1' : '0'} PARTITIONS=${lastRun.PARTITIONS_SCANNED} INDEXED=${lastRun.DOCUMENTS_INDEXED} LOCK_HONORED=1`,
  );
  log(
    'PERFORMANCE_METRICS_VALIDATED MODULE=SCHEDULER_RELIABILITY LAST_RUN_SUCCESS=1 LOCK_HELD_SKIP=1 MAX_CONCURRENT=1',
  );
  log('HEALTH_SCHEDULER_RELIABILITY_VERIFIED');
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`HEALTH_SCHEDULER_RELIABILITY_FAILED ERROR=${message}`);
  process.exit(1);
});
