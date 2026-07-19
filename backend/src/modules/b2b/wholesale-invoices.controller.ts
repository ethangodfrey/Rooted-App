import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { parseWholesaleInvoiceReconcile } from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { resolveInvoiceDisplayStatus } from './wholesale-invoice.util';
import { WholesaleOrdersService } from './wholesale-orders.service';

@Controller('api/vendors/invoices')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class WholesaleInvoicesController {
  constructor(private readonly orders: WholesaleOrdersService) {}

  /**
   * GET /api/vendors/invoices/ar-metrics
   * Seller A/R command-center totals (revenue / outstanding / at-risk).
   */
  @Get('ar-metrics')
  async arMetrics(@CurrentUser() user: AuthenticatedUser) {
    const sellerVendorId = this.requireVendor(user);
    const metrics = await this.orders.getArMetricsForSeller(sellerVendorId);
    return {
      STATUS: 'METRICS_AGGREGATION_SUCCESS',
      SESSION_VENDOR_ID: sellerVendorId,
      CURRENCY: 'USD',
      TOTAL_REVENUE_CENTS: metrics.TOTAL_REVENUE_CENTS,
      OUTSTANDING_CAPITAL_CENTS: metrics.OUTSTANDING_CAPITAL_CENTS,
      AT_RISK_CAPITAL_CENTS: metrics.AT_RISK_CAPITAL_CENTS,
      COUNTS: {
        PAID: metrics.COUNT_PAID,
        PENDING: metrics.COUNT_PENDING,
        OVERDUE: metrics.COUNT_OVERDUE,
      },
      METRICS: {
        TOTAL_REVENUE_CENTS: metrics.TOTAL_REVENUE_CENTS,
        OUTSTANDING_CAPITAL_CENTS: metrics.OUTSTANDING_CAPITAL_CENTS,
        AT_RISK_CAPITAL_CENTS: metrics.AT_RISK_CAPITAL_CENTS,
      },
    };
  }

  /**
   * POST /api/vendors/invoices/reconcile
   * Seller marks a PENDING/OVERDUE Net-30 invoice as PAID after external funds clear.
   */
  @Post('reconcile')
  @HttpCode(200)
  async reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const sellerVendorId = this.requireVendor(user);
    const parsed = parseWholesaleInvoiceReconcile(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const invoice = await this.orders.reconcileInvoiceForSeller(
      sellerVendorId,
      parsed.DATA,
    );

    return {
      STATUS: 'INVOICE_MARKED_PAID',
      LEDGER: 'LEDGER_RECONCILED',
      DISPLAY_STATUS: resolveInvoiceDisplayStatus(invoice.status, invoice.dueAt),
      INVOICE: {
        ID: invoice.id,
        ORDER_ID: invoice.orderId,
        SETTLEMENT_LOG_ID: invoice.settlementLogId ?? null,
        INVOICE_NUMBER: invoice.invoiceNumber,
        BUYER_VENDOR_ID: invoice.buyerVendorId,
        SELLER_VENDOR_ID: invoice.sellerVendorId,
        BUYER_BUSINESS_NAME: invoice.buyerBusinessName ?? null,
        SELLER_BUSINESS_NAME: invoice.sellerBusinessName ?? null,
        CURRENCY: invoice.currency,
        SUBTOTAL_CENTS: invoice.subtotalCents,
        TOTAL_CENTS: invoice.totalCents,
        PAYMENT_TERMS: invoice.paymentTerms,
        LINE_ITEMS: Array.isArray(invoice.lineItems) ? invoice.lineItems : [],
        STATUS: invoice.status,
        DISPLAY_STATUS: resolveInvoiceDisplayStatus(
          invoice.status,
          invoice.dueAt,
        ),
        ISSUED_AT: invoice.issuedAt.toISOString(),
        DUE_AT: invoice.dueAt.toISOString(),
        PAID_AT: invoice.paidAt ? invoice.paidAt.toISOString() : null,
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
