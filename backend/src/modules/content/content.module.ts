import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ContentContributionController } from './content-contribution.controller';
import { ContentContributionService } from './content-contribution.service';
import { ContentDualPostingHealthScheduler } from './content-dual-posting-health.scheduler';
import { ContentDualPostingHealthService } from './content-dual-posting-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentContributionController],
  providers: [
    ContentContributionService,
    ContentDualPostingHealthService,
    ContentDualPostingHealthScheduler,
  ],
  exports: [ContentContributionService, ContentDualPostingHealthService],
})
export class ContentModule {}
