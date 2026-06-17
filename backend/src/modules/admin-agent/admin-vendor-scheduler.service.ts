import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { AdminVendorAgentService } from './admin-vendor-agent.service';

@Injectable()
export class AdminVendorSchedulerService {
  private readonly logger = new Logger(AdminVendorSchedulerService.name);

  constructor(
    private readonly agent: AdminVendorAgentService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 5 * * *')
  async handleCron(): Promise<void> {
    const cronEnabled =
      this.config.get<string>('ADMIN_VENDOR_AGENT_CRON_ENABLED', 'true').toLowerCase() === 'true';

    if (!cronEnabled || !this.agent.isEnabled()) {
      return;
    }

    try {
      const result = await this.agent.run('scheduled');
      this.logger.log(
        `Scheduled admin vendor review finished: ${result.suggestions} suggestions, ${result.errors.length} errors`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scheduled admin vendor review failed: ${message}`);
    }
  }
}
