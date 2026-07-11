import { BadRequestException, Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import type { PosActivityDashboardResponse } from '../dto/pos-activity-dashboard.dto';
import { PosActivityDashboardService } from '../services/pos-activity-dashboard.service';

/**
 * Vendor-facing POS activity dashboard.
 * Aggregates the last 24 hours of sync runs + inventory transactions in one call.
 */
@Controller('pos/activity')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class PosActivityController {
  constructor(private readonly dashboard: PosActivityDashboardService) {}

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: AuthenticatedUser): Promise<PosActivityDashboardResponse> {
    const vendorId = this.requireVendor(user);
    return this.dashboard.getDashboard(vendorId);
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new BadRequestException('Authenticated user has no vendor profile.');
    }
    return user.vendorId;
  }
}
