import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { SupplierArAnalyticsService } from './supplier-ar-analytics.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('api/vendors/:vendorId/analytics')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class SupplierAnalyticsController {
  constructor(private readonly arAnalytics: SupplierArAnalyticsService) {}

  /**
   * GET /api/vendors/:vendorId/analytics/ar-summary
   * Seller A/R dashboard: average days to pay, pending vs collected revenue.
   */
  @Get('ar-summary')
  async getArSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId') vendorId: string,
  ) {
    const sessionVendorId = this.requireVendor(user);
    const normalizedVendorId = vendorId.trim();
    if (!UUID_RE.test(normalizedVendorId)) {
      throw new BadRequestException(
        'ANALYTICS_VALIDATION_ERROR: VENDOR_ID INVALID',
      );
    }

    const summary = await this.arAnalytics.getArSummaryForSeller(
      sessionVendorId,
      normalizedVendorId,
    );

    return {
      STATUS: 'SUPPLIER_AR_SUMMARY',
      SESSION_VENDOR_ID: sessionVendorId,
      VENDOR_ID: normalizedVendorId,
      CURRENCY: 'USD',
      AVERAGE_DAYS_TO_PAY: summary.AVERAGE_DAYS_TO_PAY,
      COLLECTED_REVENUE_CENTS: summary.COLLECTED_REVENUE_CENTS,
      PENDING_REVENUE_CENTS: summary.PENDING_REVENUE_CENTS,
      AT_RISK_REVENUE_CENTS: summary.AT_RISK_REVENUE_CENTS,
      METRICS: {
        TOTAL_REVENUE_CENTS: summary.TOTAL_REVENUE_CENTS,
        OUTSTANDING_CAPITAL_CENTS: summary.OUTSTANDING_CAPITAL_CENTS,
        AT_RISK_CAPITAL_CENTS: summary.AT_RISK_CAPITAL_CENTS,
      },
      COUNTS: {
        PAID: summary.COUNT_PAID,
        PENDING: summary.COUNT_PENDING,
        OVERDUE: summary.COUNT_OVERDUE,
      },
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
