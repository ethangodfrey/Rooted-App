import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../../prisma/prisma.service';
import { PosSyncService } from '../services/pos-sync.service';

/**
 * Periodically enqueues incremental syncs for active connections whose cadence
 * has elapsed. Runs every 5 minutes; each connection's sync_frequency_minutes
 * controls how often it is actually picked up.
 */
@Injectable()
export class PosSchedulerService {
  private readonly logger = new Logger(PosSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: PosSyncService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async enqueueDueSyncs(): Promise<void> {
    const connections = await this.prisma.posConnection.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, lastSyncedAt: true, syncFrequencyMinutes: true },
    });

    const now = Date.now();
    const due = connections.filter((c) => {
      if (!c.lastSyncedAt) return true;
      const elapsedMin = (now - c.lastSyncedAt.getTime()) / 60_000;
      return elapsedMin >= c.syncFrequencyMinutes;
    });

    if (due.length === 0) return;
    this.logger.log(`Enqueuing ${due.length} scheduled POS sync(s)`);
    await Promise.all(due.map((c) => this.sync.queueSync(c.id, 'SCHEDULED')));
  }
}
