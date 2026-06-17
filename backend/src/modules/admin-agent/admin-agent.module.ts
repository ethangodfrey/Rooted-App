import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AdminPostAgentService } from './admin-post-agent.service';
import { AdminPostAiService } from './admin-post-ai.service';
import { AdminPostFeedbackService } from './admin-post-feedback.service';
import { AdminPostSchedulerService } from './admin-post-scheduler.service';
import { AdminPostsController } from './admin-posts.controller';
import { AdminVendorAgentService } from './admin-vendor-agent.service';
import { AdminVendorAiService } from './admin-vendor-ai.service';
import { AdminVendorFeedbackService } from './admin-vendor-feedback.service';
import { AdminVendorSchedulerService } from './admin-vendor-scheduler.service';
import { AdminVendorsController } from './admin-vendors.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminVendorsController, AdminPostsController],
  providers: [
    AdminVendorAiService,
    AdminVendorFeedbackService,
    AdminVendorAgentService,
    AdminVendorSchedulerService,
    AdminPostAiService,
    AdminPostFeedbackService,
    AdminPostAgentService,
    AdminPostSchedulerService,
  ],
  exports: [
    AdminVendorAgentService,
    AdminVendorFeedbackService,
    AdminPostAgentService,
    AdminPostFeedbackService,
  ],
})
export class AdminAgentModule {}
