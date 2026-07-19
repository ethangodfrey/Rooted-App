import {
  BadRequestException,
  Body,
  Controller,
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
   * POST /api/vendors/invoices/reconcile
   * Seller marks an ISSUED Net-30 invoice as PAID after external funds clear.
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
