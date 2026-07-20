import {
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../../common/auth/admin.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  formatAdminDashboardActiveLog,
  formatSystemTelemetryInitializedLog,
} from './admin-dashboard.util';

/**
 * Platform Admin Dashboard APIs.
 * Guarded by AdminGuard — vendors/farmers receive 403 ADMIN_ROLE_REQUIRED.
 */
@Controller('api/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminDashboardController implements OnModuleInit {
  private readonly logger = new Logger(AdminDashboardController.name);

  constructor(private readonly dashboard: AdminDashboardService) {}

  onModuleInit(): void {
    this.logger.log(formatSystemTelemetryInitializedLog());
    this.logger.log(formatAdminDashboardActiveLog());
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
}
