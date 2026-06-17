import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  type PosConnection,
  type PosSyncRun,
  type PosSyncStatus,
  type PosSyncTrigger,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { PosJobsService } from '../jobs/pos-jobs.service';
import type { SyncConnectionJobData } from '../jobs/pos-queue.constants';
import { POS_DEFAULTS } from '../pos.constants';
import { PosConnectionService } from './pos-connection.service';
import { PosImportService } from './pos-import.service';
import { ProviderRegistryService } from './provider-registry.service';

@Injectable()
export class PosSyncService {
  private readonly logger = new Logger(PosSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly connections: PosConnectionService,
    private readonly importer: PosImportService,
    private readonly jobs: PosJobsService,
  ) {}

  /** Creates a QUEUED sync run and enqueues the job. Used by API + scheduler. */
  async queueSync(
    connectionId: string,
    trigger: PosSyncTrigger,
    overrides?: { since?: string; until?: string },
  ): Promise<PosSyncRun> {
    const run = await this.prisma.posSyncRun.create({
      data: { connectionId, trigger, status: 'QUEUED' },
    });
    try {
      const job = await this.jobs.enqueueSync({
        connectionId,
        trigger,
        syncRunId: run.id,
        since: overrides?.since,
        until: overrides?.until,
      });
      return this.prisma.posSyncRun.update({
        where: { id: run.id },
        data: { jobId: job.id != null ? String(job.id) : undefined },
      });
    } catch (err) {
      await this.prisma.posSyncRun.delete({ where: { id: run.id } }).catch(() => undefined);
      throw err;
    }
  }

  listRuns(connectionId: string, limit = 50): Promise<PosSyncRun[]> {
    return this.prisma.posSyncRun.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Executes a sync run end-to-end. Invoked by the BullMQ processor. */
  async runSync(data: SyncConnectionJobData): Promise<void> {
    const connection = await this.prisma.posConnection.findUnique({
      where: { id: data.connectionId },
    });
    if (!connection || connection.status === 'DISCONNECTED') {
      this.logger.warn(`Skipping sync for missing/disconnected connection ${data.connectionId}`);
      return;
    }

    const window = this.resolveWindow(connection, data);
    await this.prisma.posSyncRun.update({
      where: { id: data.syncRunId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        windowStart: new Date(window.since),
        windowEnd: new Date(window.until),
        cursorStart: connection.lastCursor,
      },
    });

    const totals = { fetched: 0, imported: 0, skipped: 0, errors: 0 };
    const affectedDates = new Set<string>();
    let cursor: string | null | undefined = data.trigger === 'BACKFILL' ? null : connection.lastCursor;
    let finalStatus: PosSyncStatus = 'SUCCESS';
    let failure: Error | null = null;

    try {
      const adapter = this.registry.get(connection.provider);
      const credentials = await this.connections.getUsableCredentials(connection.id);

      // Paginate through all pages within the window, with a hard safety cap and
      // cursor-loop detection so a misbehaving provider can never spin forever.
      const seenCursors = new Set<string>();
      const MAX_PAGES = 2_000;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await adapter.fetchTransactions({
          credentials,
          locationId: connection.providerLocationId ?? undefined,
          since: window.since,
          until: window.until,
          cursor,
          pageSize: POS_DEFAULTS.PAGE_SIZE,
        });

        totals.fetched += result.transactions.length;
        const res = await this.importer.importTransactions(
          connection,
          data.syncRunId,
          result.transactions,
        );
        totals.imported += res.imported + res.updated;
        totals.skipped += res.skipped;
        res.affectedDates.forEach((d) => affectedDates.add(d));

        const next = result.nextCursor;
        if (!next || seenCursors.has(next)) break;
        seenCursors.add(next);
        cursor = next;
      }

      await this.prisma.posConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          lastCursor: null, // window-based; cursor only valid within a run
          status: 'ACTIVE',
          errorMessage: null,
        },
      });
    } catch (err) {
      finalStatus = 'FAILED';
      totals.errors += 1;
      failure = err instanceof Error ? err : new Error('Unknown sync error');
      const message = failure.message;
      this.logger.error(`Sync failed for ${connection.id}: ${message}`);
      await this.prisma.posSyncError.create({
        data: {
          connectionId: connection.id,
          syncRunId: data.syncRunId,
          scope: 'SYNC',
          message: message.slice(0, 1000),
          retryable: true,
          payload: { window } as Prisma.InputJsonValue,
        },
      });
      await this.connections.markError(connection.id, message);
    }

    const errorCount = await this.prisma.posSyncError.count({
      where: { syncRunId: data.syncRunId },
    });
    if (finalStatus === 'SUCCESS' && errorCount > 0) finalStatus = 'PARTIAL';

    await this.prisma.posSyncRun.update({
      where: { id: data.syncRunId },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        transactionsFetched: totals.fetched,
        transactionsImported: totals.imported,
        transactionsSkipped: totals.skipped,
        errorCount,
      },
    });

    if (affectedDates.size > 0) {
      await this.jobs.enqueueAggregation({
        vendorId: connection.vendorId,
        dates: [...affectedDates],
      });
    }

    // Re-throw so BullMQ retries with the configured exponential backoff. The run
    // row + error log are already persisted above; a later successful attempt
    // updates the same run to SUCCESS.
    if (failure) {
      throw failure;
    }
  }

  private resolveWindow(
    connection: PosConnection,
    data: SyncConnectionJobData,
  ): { since: string; until: string } {
    const until = data.until ?? new Date().toISOString();
    if (data.since) return { since: data.since, until };

    if (data.trigger === 'BACKFILL' || !connection.lastSyncedAt) {
      const since = new Date(
        Date.now() - POS_DEFAULTS.INITIAL_BACKFILL_DAYS * 86_400_000,
      ).toISOString();
      return { since, until };
    }

    const overlapMs = POS_DEFAULTS.INCREMENTAL_OVERLAP_MINUTES * 60_000;
    const since = new Date(connection.lastSyncedAt.getTime() - overlapMs).toISOString();
    return { since, until };
  }
}
