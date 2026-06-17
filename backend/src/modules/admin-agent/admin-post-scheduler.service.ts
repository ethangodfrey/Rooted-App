import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { AdminPostAgentService } from './admin-post-agent.service';

@Injectable()
export class AdminPostSchedulerService {
  private readonly logger = new Logger(AdminPostSchedulerService.name);

  constructor(
    private readonly agent: AdminPostAgentService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 * * * *')
  async handleCron(): Promise<void> {
    const cronEnabled =
      this.config.get<string>('ADMIN_POST_AGENT_CRON_ENABLED', 'true').toLowerCase() === 'true';

    if (!cronEnabled || !this.agent.isEnabled()) return;

    try {
      const result = await this.agent.run('scheduled');
      this.logger.log(
        `Scheduled post moderation finished: ${result.suggestions} reviewed, ${result.flagged} flagged`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scheduled post moderation failed: ${message}`);
    }
  }
}
