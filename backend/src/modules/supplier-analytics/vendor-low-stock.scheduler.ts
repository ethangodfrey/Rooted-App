import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { VendorAlertsService } from './vendor-alerts.service';

/**
 * Daily low-stock alert sweep (07:30 server time).
 * Gate: SUPPLIER_LOW_STOCK_CRON_ENABLED (default true).
 */
@Injectable()
export class VendorLowStockScheduler {
  private readonly logger = new Logger(VendorLowStockScheduler.name);

  constructor(
    private readonly alerts: VendorAlertsService,
    private readonly config: ConfigService,
  ) {}

  @Cron('30 7 * * *')
  async handleDailyLowStockSweep(): Promise<void> {
    const cronEnabled =
      this.config
        .get<string>('SUPPLIER_LOW_STOCK_CRON_ENABLED', 'true')
        .toLowerCase() === 'true';
    if (!cronEnabled) {
      this.logger.log('LOW_STOCK_SWEEP_EXECUTED SKIPPED REASON=DISABLED');
      return;
    }

    try {
      const result = await this.alerts.sweepLowStockForAllVendors();
      this.logger.log(
        `LOW_STOCK_SWEEP_EXECUTED VENDORS=${result.vendors} ALERTS=${result.alerts}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`LOW_STOCK_SWEEP_EXECUTED FAILED ERROR=${message}`);
    }
  }
}
