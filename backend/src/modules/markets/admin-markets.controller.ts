import { Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { MarketsAgentService } from './markets-agent.service';
import { MarketsEnrichmentService } from './markets-enrichment.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/markets')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminMarketsController {
  constructor(
    private readonly agent: MarketsAgentService,
    private readonly enrichment: MarketsEnrichmentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('sync')
  async triggerSync() {
    const result = await this.agent.run('manual');
    return result;
  }

  @Post('images/google')
  async backfillGoogleImages() {
    return this.enrichment.backfillGooglePlacesImages(30);
  }

  @Post('images')
  async backfillImages() {
    return this.enrichment.backfillImages(50);
  }

  @Post('fix-times')
  async fixTimesAndWebsites() {
    return this.enrichment.backfillTimesAndWebsites(100);
  }

  @Get('enrich-status')
  async enrichStatus() {
    const pending = await this.enrichment.countPending();
    return { pending };
  }

  @Post('enrich')
  async triggerEnrich() {
    const result = await this.enrichment.enrichPending();
    return result;
  }

  @Get('sync-runs')
  async listSyncRuns() {
    return this.prisma.marketSyncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }
}
