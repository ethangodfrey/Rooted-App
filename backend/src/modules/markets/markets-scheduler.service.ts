import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { MarketsAgentService } from './markets-agent.service';

/** Runs daily at 04:00 server time when MARKETS_AGENT_ENABLED=true. */
@Injectable()
export class MarketsSchedulerService {
  private readonly logger = new Logger(MarketsSchedulerService.name);

  constructor(
    private readonly agent: MarketsAgentService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 4 * * *')
  async runDailyDiscovery(): Promise<void> {
    if (!this.agent.isEnabled()) return;

    const cronEnabled =
      this.config.get<string>('MARKETS_AGENT_CRON_ENABLED', 'true').toLowerCase() === 'true';
    if (!cronEnabled) return;

    this.logger.log('Starting scheduled market agent run');
    try {
      await this.agent.run('scheduled');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scheduled market agent failed: ${message}`);
    }
  }
}
