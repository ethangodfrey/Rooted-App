import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AdminCommunityEventAiService } from './admin-community-event-ai.service';
import { AdminCommunityEventsController } from './admin-community-events.controller';
import { AdminEventIngestService } from './admin-event-ingest.service';
import { AdminIngestEventsController } from './admin-ingest-events.controller';
import { AdminPostAgentService } from './admin-post-agent.service';
import { AdminPostAiService } from './admin-post-ai.service';
import { AdminPostFeedbackService } from './admin-post-feedback.service';
import { AdminPostSchedulerService } from './admin-post-scheduler.service';
import { AdminPostsController } from './admin-posts.controller';
import { AdminSeedNetworkController } from './admin-seed-network.controller';
import { AdminSeedNetworkService } from './admin-seed-network.service';
import { AdminVendorAgentService } from './admin-vendor-agent.service';
import { AdminVendorAiService } from './admin-vendor-ai.service';
import { AdminVendorFeedbackService } from './admin-vendor-feedback.service';
import { AdminVendorSchedulerService } from './admin-vendor-scheduler.service';
import { AdminVendorsController } from './admin-vendors.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminVendorsController,
    AdminPostsController,
    AdminCommunityEventsController,
    AdminIngestEventsController,
    AdminSeedNetworkController,
  ],
  providers: [
    AdminVendorAiService,
    AdminVendorFeedbackService,
    AdminVendorAgentService,
    AdminVendorSchedulerService,
    AdminPostAiService,
    AdminPostFeedbackService,
    AdminPostAgentService,
    AdminPostSchedulerService,
    AdminCommunityEventAiService,
    AdminEventIngestService,
    AdminSeedNetworkService,
  ],
  exports: [
    AdminVendorAgentService,
    AdminVendorFeedbackService,
    AdminPostAgentService,
    AdminPostFeedbackService,
    AdminCommunityEventAiService,
    AdminEventIngestService,
    AdminSeedNetworkService,
  ],
})
export class AdminAgentModule {}
