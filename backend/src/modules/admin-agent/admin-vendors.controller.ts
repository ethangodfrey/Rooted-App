import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminVendorAgentService } from './admin-vendor-agent.service';
import { AdminVendorFeedbackService } from './admin-vendor-feedback.service';

@Controller('admin/vendors')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminVendorsController {
  constructor(
    private readonly agent: AdminVendorAgentService,
    private readonly feedback: AdminVendorFeedbackService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('review')
  async reviewPendingQueue() {
    return this.agent.run('manual');
  }

  @Get('agent/runs')
  async listRuns() {
    return this.prisma.adminAgentRun.findMany({
      where: { agentType: 'vendor_review' },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  @Get('feedback/stats')
  async feedbackStats() {
    return this.feedback.stats();
  }

  @Post(':id/review')
  async reviewOne(@Param('id') id: string) {
    return this.agent.reviewVendor(id);
  }

  @Get(':id/suggestion')
  async latestSuggestion(@Param('id') id: string) {
    const suggestion = await this.agent.latestSuggestion(id);
    return suggestion ?? null;
  }
}
