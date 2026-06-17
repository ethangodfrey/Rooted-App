import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminPostAgentService } from './admin-post-agent.service';
import { AdminPostFeedbackService } from './admin-post-feedback.service';

@Controller('admin/posts')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPostsController {
  constructor(
    private readonly agent: AdminPostAgentService,
    private readonly feedback: AdminPostFeedbackService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('moderate')
  async moderateQueue() {
    return this.agent.run('manual');
  }

  @Get('agent/runs')
  async listRuns() {
    return this.prisma.adminAgentRun.findMany({
      where: { agentType: 'post_moderation' },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  @Get('feedback/stats')
  async feedbackStats() {
    return this.feedback.stats();
  }

  @Post(':id/moderate')
  async moderateOne(@Param('id') id: string) {
    return this.agent.moderatePost(id);
  }

  @Get(':id/suggestion')
  async latestSuggestion(@Param('id') id: string) {
    const suggestion = await this.agent.latestSuggestion(id);
    return suggestion ?? null;
  }
}
