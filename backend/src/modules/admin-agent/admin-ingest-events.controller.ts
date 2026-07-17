import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import {
  AdminEventIngestService,
  type IngestEventsRequest,
} from './admin-event-ingest.service';

@Controller('admin/ingest-events')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminIngestEventsController {
  constructor(private readonly ingest: AdminEventIngestService) {}

  /**
   * POST /admin/ingest-events
   * Runs the AI local event discovery worker and writes PENDING community_events.
   */
  @Post()
  async runLiveSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: IngestEventsRequest,
  ) {
    return this.ingest.ingest(user.id, body ?? {});
  }
}
