import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../../common/auth/admin.guard';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/decorators';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { DisputeService } from '../disputes/dispute.service';
import {
  formatDisputeEngineInitializedLog,
  formatEscrowFrozenActiveLog,
} from '../disputes/dispute.util';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  formatAdminDashboardActiveLog,
  formatSystemTelemetryInitializedLog,
} from './admin-dashboard.util';

/**
 * Platform Admin Dashboard + Dispute Queue APIs.
 * Guarded by AdminGuard — vendors/farmers receive 403 ADMIN_ROLE_REQUIRED.
 */
@Controller('api/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminDashboardController implements OnModuleInit {
  private readonly logger = new Logger(AdminDashboardController.name);

  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly disputes: DisputeService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatSystemTelemetryInitializedLog());
    this.logger.log(formatAdminDashboardActiveLog());
    this.logger.log(formatDisputeEngineInitializedLog());
    this.logger.log(formatEscrowFrozenActiveLog());
  }

  /** GET /api/admin/telemetry — GMV, Active Escrow, Platform Revenue. */
  @Get('telemetry')
  getTelemetry() {
    return this.dashboard.getTelemetry();
  }

  /** GET /api/admin/logistics — all IN_TRANSIT delivery routes. */
  @Get('logistics')
  getLogistics(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.dashboard.getActiveLogistics(
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  /**
   * GET /api/admin/ledger — paginated global financial_transactions.
   * Sortable by transaction_type / status.
   */
  @Get('ledger')
  getLedger(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('transactionType') transactionType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.dashboard.listLedger({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
      transactionType,
      sortBy,
      sortDir,
    });
  }

  /** GET /api/admin/disputes — OPEN + IN_REVIEW queue. */
  @Get('disputes')
  listDisputes(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.disputes.listOpenDisputes(Number.isFinite(parsed) ? parsed : 50);
  }

  /** POST /api/admin/disputes/:id/refund — Approve Refund. */
  @Post('disputes/:id/refund')
  approveRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { notes?: string },
  ) {
    if (!id?.trim()) throw new BadRequestException('DISPUTE_ID_REQUIRED');
    return this.disputes.approveRefund({
      disputeId: id,
      adminUserId: user.id,
      notes: body?.notes,
    });
  }

  /** POST /api/admin/disputes/:id/dismiss — Dismiss Dispute / unfreeze. */
  @Post('disputes/:id/dismiss')
  dismissDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { notes?: string; settle?: boolean },
  ) {
    if (!id?.trim()) throw new BadRequestException('DISPUTE_ID_REQUIRED');
    return this.disputes.dismissDispute({
      disputeId: id,
      adminUserId: user.id,
      notes: body?.notes,
      settle: Boolean(body?.settle),
    });
  }
}
