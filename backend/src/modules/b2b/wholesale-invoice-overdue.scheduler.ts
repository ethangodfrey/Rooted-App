import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { WholesaleInvoiceOverdueService } from './wholesale-invoice-overdue.service';

/**
 * Daily Net-30 overdue compliance cron (06:00 server time).
 * Gate: WHOLESALE_INVOICE_OVERDUE_CRON_ENABLED (default true).
 * Telemetry: CRON_SWEEP_EXECUTED, INVOICES_MARKED_OVERDUE
 */
@Injectable()
export class WholesaleInvoiceOverdueScheduler {
  private readonly logger = new Logger(WholesaleInvoiceOverdueScheduler.name);

  constructor(
    private readonly overdue: WholesaleInvoiceOverdueService,
    private readonly config: ConfigService,
  ) {}

  /** Daily at 06:00 — PENDING invoices with due_at < NOW() → OVERDUE. */
  @Cron('0 6 * * *')
  async handleDailyOverdueSweep(): Promise<void> {
    const cronEnabled =
      this.config
        .get<string>('WHOLESALE_INVOICE_OVERDUE_CRON_ENABLED', 'true')
        .toLowerCase() === 'true';
    if (!cronEnabled) {
      this.logger.log('CRON_SWEEP_EXECUTED SKIPPED REASON=DISABLED');
      return;
    }

    try {
      await this.overdue.sweepOverdueInvoices();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`CRON_SWEEP_EXECUTED FAILED ERROR=${message}`);
    }
  }
}
