import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MarketNotificationService } from './market-notification.service';

/**
 * Background job: push MARKET_ALERT when an event starts within a shopper's radius.
 * Gate: MARKET_ALERT_CRON_ENABLED (default true in production).
 */
@Injectable()
export class MarketNotificationScheduler implements OnModuleInit {
  private readonly logger = new Logger(MarketNotificationScheduler.name);
  private readonly cronEnabled: boolean;
  private inFlight = false;

  constructor(
    private readonly notifications: MarketNotificationService,
    private readonly config: ConfigService,
  ) {
    const raw = (
      this.config.get<string>('MARKET_ALERT_CRON_ENABLED') ?? ''
    )
      .trim()
      .toLowerCase();
    const nodeEnv = (
      this.config.get<string>('NODE_ENV') ?? 'development'
    ).toLowerCase();
    if (raw === 'true') this.cronEnabled = true;
    else if (raw === 'false') this.cronEnabled = false;
    else this.cronEnabled = nodeEnv === 'production';
  }

  onModuleInit(): void {
    this.logger.log(
      `NOTIFICATION_SERVICE_INITIALIZED SCHEDULER=MarketNotificationScheduler CRON=${CronExpression.EVERY_5_MINUTES} ENABLED=${this.cronEnabled ? '1' : '0'}`,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleMarketAlertSweep(): Promise<void> {
    if (!this.cronEnabled) {
      this.logger.log('MARKET_ALERT_CRON_SKIPPED REASON=DISABLED');
      return;
    }
    if (this.inFlight) {
      this.logger.log('MARKET_ALERT_CRON_SKIPPED REASON=LOCK_HELD');
      return;
    }

    this.inFlight = true;
    try {
      const result = await this.notifications.dispatchStartingMarketAlerts();
      this.logger.log(
        `MARKET_ALERT_CRON_COMPLETED DISPATCHED=${result.DISPATCHED} CANDIDATES=${result.CANDIDATES}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `MARKET_ALERT_CRON_FAILED ERROR=${message} CONTINUING=1`,
      );
    } finally {
      this.inFlight = false;
    }
  }
}
