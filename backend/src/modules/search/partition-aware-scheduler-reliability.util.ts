/**
 * Health suite — PartitionAwareOrderIndexer scheduler reliability.
 * Tracks last-run status and enforces a non-overlapping in-process lock.
 */

export type SchedulerLastRunStatus = {
  SUCCESS: boolean;
  STARTED_AT: string | null;
  FINISHED_AT: string | null;
  SKIPPED_REASON: 'DISABLED' | 'LOCK_HELD' | null;
  PARTITIONS_SCANNED: number;
  DOCUMENTS_INDEXED: number;
  ERROR: string | null;
};

export type SyncRecentPartitionsResult = {
  PARTITIONS_SCANNED: number;
  DOCUMENTS_INDEXED: number;
  SKIPPED_REASON: string | null;
};

export type PartitionAwareSyncRunner = {
  syncRecentPartitions: () => Promise<SyncRecentPartitionsResult>;
};

/**
 * Pure lock + last-run controller used by the Nest scheduler and regression tests.
 */
export class PartitionAwareSchedulerController {
  private syncInFlight = false;
  private lastRun: SchedulerLastRunStatus = {
    SUCCESS: false,
    STARTED_AT: null,
    FINISHED_AT: null,
    SKIPPED_REASON: null,
    PARTITIONS_SCANNED: 0,
    DOCUMENTS_INDEXED: 0,
    ERROR: null,
  };

  constructor(
    private readonly runner: PartitionAwareSyncRunner,
    private readonly enabled: boolean = true,
  ) {}

  getLastRunStatus(): SchedulerLastRunStatus {
    return { ...this.lastRun };
  }

  isSyncInFlight(): boolean {
    return this.syncInFlight;
  }

  async triggerSync(): Promise<SchedulerLastRunStatus> {
    if (!this.enabled) {
      this.lastRun = {
        SUCCESS: false,
        STARTED_AT: null,
        FINISHED_AT: new Date().toISOString(),
        SKIPPED_REASON: 'DISABLED',
        PARTITIONS_SCANNED: 0,
        DOCUMENTS_INDEXED: 0,
        ERROR: null,
      };
      return this.getLastRunStatus();
    }

    if (this.syncInFlight) {
      this.lastRun = {
        ...this.lastRun,
        SKIPPED_REASON: 'LOCK_HELD',
      };
      return this.getLastRunStatus();
    }

    this.syncInFlight = true;
    const startedAt = new Date().toISOString();
    try {
      const result = await this.runner.syncRecentPartitions();
      this.lastRun = {
        SUCCESS: true,
        STARTED_AT: startedAt,
        FINISHED_AT: new Date().toISOString(),
        SKIPPED_REASON: null,
        PARTITIONS_SCANNED: result.PARTITIONS_SCANNED,
        DOCUMENTS_INDEXED: result.DOCUMENTS_INDEXED,
        ERROR: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastRun = {
        SUCCESS: false,
        STARTED_AT: startedAt,
        FINISHED_AT: new Date().toISOString(),
        SKIPPED_REASON: null,
        PARTITIONS_SCANNED: 0,
        DOCUMENTS_INDEXED: 0,
        ERROR: message,
      };
    } finally {
      this.syncInFlight = false;
    }

    return this.getLastRunStatus();
  }
}
