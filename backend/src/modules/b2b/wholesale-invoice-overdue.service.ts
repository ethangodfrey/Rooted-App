import { Injectable, Logger } from '@nestjs/common';
import { WholesaleInvoiceStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export type OverdueSweepResult = {
  COUNT: number;
  SWEPT_AT: string;
};

/**
 * Atomic Net-30 compliance sweeper: PENDING + past due_at → OVERDUE.
 * Telemetry: CRON_SWEEP_EXECUTED, INVOICES_MARKED_OVERDUE
 */
@Injectable()
export class WholesaleInvoiceOverdueService {
  private readonly logger = new Logger(WholesaleInvoiceOverdueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bulk-mark expired PENDING invoices OVERDUE inside a single transaction.
   */
  async sweepOverdueInvoices(now: Date = new Date()): Promise<OverdueSweepResult> {
    const sweptAt = now.toISOString();
    this.logger.log(`CRON_SWEEP_EXECUTED AT=${sweptAt}`);

    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.wholesaleInvoice.updateMany({
        where: {
          status: WholesaleInvoiceStatus.PENDING,
          dueAt: { lt: now },
        },
        data: {
          status: WholesaleInvoiceStatus.OVERDUE,
        },
      });
      return result.count;
    });

    this.logger.log(`INVOICES_MARKED_OVERDUE COUNT=${count}`);
    return { COUNT: count, SWEPT_AT: sweptAt };
  }
}
