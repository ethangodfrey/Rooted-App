import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AnalyticsReportingService } from './analytics-reporting.service';
import { formatAnalyticsDashboardInitializedLog } from './analytics.util';

@Controller('api/analytics')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class AnalyticsController implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analytics: AnalyticsReportingService) {}

  onModuleInit(): void {
    this.logger.log(formatAnalyticsDashboardInitializedLog());
  }

  /**
   * GET /api/analytics/summary
   * Performance metrics for the caller's posts, catering inquiries, and collaborations.
   */
  @Get('summary')
  @Roles('vendor', 'farmer', 'admin')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') daysRaw?: string,
  ) {
    const days =
      daysRaw != null && daysRaw !== '' ? Number(daysRaw) : undefined;
    return this.analytics.getSummary({
      userId: user.id,
      vendorId: user.vendorId ?? null,
      role: user.role,
      days: days != null && Number.isFinite(days) ? days : 30,
    });
  }

  @Post('events')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async recordEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      metricType?: string;
      target?: 'POST_CONTRIBUTION' | 'CATERING_INQUIRY' | 'ENTITY';
      targetId?: string | null;
      delta?: number;
      entityVendorId?: string | null;
      entityRole?: string | null;
    },
  ) {
    if (!body.metricType?.trim()) {
      throw new BadRequestException('METRIC_TYPE_REQUIRED');
    }
    return this.analytics.recordInteraction({
      userId: body.entityVendorId ? user.id : user.id,
      vendorId: body.entityVendorId ?? user.vendorId ?? null,
      role: body.entityRole ?? user.role,
      metricType: body.metricType,
      target: body.target ?? 'ENTITY',
      targetId: body.targetId ?? null,
      delta: body.delta,
    });
  }
}
