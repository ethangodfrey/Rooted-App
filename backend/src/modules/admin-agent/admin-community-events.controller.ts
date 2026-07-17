import { Controller, Param, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { AdminCommunityEventAiService } from './admin-community-event-ai.service';

@Controller('admin/community-events')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCommunityEventsController {
  constructor(private readonly ai: AdminCommunityEventAiService) {}

  @Post(':id/verify')
  async verifyOne(@Param('id') id: string) {
    return this.ai.verify(id);
  }
}
