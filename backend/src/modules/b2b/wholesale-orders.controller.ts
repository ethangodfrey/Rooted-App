import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  parseWholesaleOrderDraftCreate,
  parseWholesaleOrderFulfillment,
  parseWholesaleOrderSettlement,
} from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { WholesaleOrdersService } from './wholesale-orders.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('api/vendors/orders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class WholesaleOrdersController {
  constructor(private readonly orders: WholesaleOrdersService) {}

  /**
   * POST /api/vendors/orders/drafts
   * Initialize a multi-tenant wholesale order draft from validated line items.
   */
  @Post('drafts')
  @HttpCode(201)
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const vendorId = this.requireVendor(user);
    const parsed = parseWholesaleOrderDraftCreate(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const order = await this.orders.createDraft(vendorId, parsed.DATA);
    return {
      STATUS: 'ORDER_DRAFT_INITIALIZED',
      ORDER: this.serializeOrder(order),
    };
  }

  /**
   * GET /api/vendors/orders/inbound
   * Seller-facing list of wholesale drafts / responses.
   */
  @Get('inbound')
  async listInbound(@CurrentUser() user: AuthenticatedUser) {
    const sellerVendorId = this.requireVendor(user);
    const rows = await this.orders.listInboundForSeller(sellerVendorId);
    return {
      STATUS: 'WHOLESALE_INBOUND_ORDERS',
      VIEW: 'SELLER',
      SESSION_VENDOR_ID: sellerVendorId,
      COUNT: rows.length,
      ORDERS: rows.map((order) => this.serializeOrder(order)),
    };
  }

  /**
   * GET /api/vendors/orders/outbound
   * Buyer-facing list of wholesale purchases / shipments.
   */
  @Get('outbound')
  async listOutbound(@CurrentUser() user: AuthenticatedUser) {
    const buyerVendorId = this.requireVendor(user);
    const rows = await this.orders.listOutboundForBuyer(buyerVendorId);
    return {
      STATUS: 'WHOLESALE_OUTBOUND_ORDERS',
      VIEW: 'BUYER',
      SESSION_VENDOR_ID: buyerVendorId,
      COUNT: rows.length,
      ORDERS: rows.map((order) => this.serializeOrder(order)),
    };
  }

  /**
   * POST /api/vendors/orders/fulfillment
   * Transition ORDER_ACCEPTED_BY_SELLER → ORDER_SHIPPED_IN_TRANSIT with carrier manifest.
   */
  @Post('fulfillment')
  @HttpCode(200)
  async fulfill(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const sellerVendorId = this.requireVendor(user);
    const parsed = parseWholesaleOrderFulfillment(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }
    const order = await this.orders.fulfillForSeller(sellerVendorId, parsed.DATA);
    return {
      STATUS: 'ORDER_FULFILLMENT_TRACKED',
      ORDER: this.serializeOrder(order),
    };
  }

  /**
   * POST /api/vendors/orders/settlement
   * Transition ORDER_SHIPPED_IN_TRANSIT → ORDER_DELIVERY_CONFIRMED + ledger settle.
   */
  @Post('settlement')
  @HttpCode(200)
  async settle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const buyerVendorId = this.requireVendor(user);
    const parsed = parseWholesaleOrderSettlement(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }
    const { order, invoice } = await this.orders.settleForBuyer(
      buyerVendorId,
      parsed.DATA,
    );
    return {
      STATUS: 'ORDER_DELIVERY_CONFIRMED',
      LEDGER: 'WHOLESALE_LEDGER_SETTLED',
      BILLING: 'BILLING_LEDGER_UPDATED',
      INVOICE: this.serializeInvoice(invoice),
      ORDER: this.serializeOrder({
        ...order,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
        },
      }),
    };
  }

  /**
   * GET /api/vendors/orders/invoices/:invoiceId
   * Buyer or seller invoice detail for Net-30 billing paper trail.
   */
  @Get('invoices/:invoiceId')
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    const vendorId = this.requireVendor(user);
    if (!UUID_RE.test(invoiceId.trim())) {
      throw new BadRequestException(
        'WHOLESALE_INVOICE_VALIDATION_ERROR: INVOICE_ID INVALID',
      );
    }
    const invoice = await this.orders.getInvoiceForVendor(
      vendorId,
      invoiceId.trim(),
    );
    return {
      STATUS: 'WHOLESALE_INVOICE',
      INVOICE: this.serializeInvoice(invoice),
    };
  }

  /**
   * POST /api/vendors/orders/:orderId/accept
   * Transition ORDER_DRAFT_INITIALIZED → ORDER_ACCEPTED_BY_SELLER + reserve inventory.
   */
  @Post(':orderId/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    const sellerVendorId = this.requireVendor(user);
    if (!UUID_RE.test(orderId.trim())) {
      throw new BadRequestException('WHOLESALE_ORDER_VALIDATION_ERROR: ORDER_ID INVALID');
    }
    const order = await this.orders.acceptForSeller(
      sellerVendorId,
      orderId.trim(),
    );
    return {
      STATUS: 'ORDER_ACCEPTED_BY_SELLER',
      ORDER: this.serializeOrder(order),
    };
  }

  /**
   * POST /api/vendors/orders/:orderId/reject
   * Transition ORDER_DRAFT_INITIALIZED → ORDER_REJECTED_BY_SELLER (no stock change).
   */
  @Post(':orderId/reject')
  @HttpCode(200)
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    const sellerVendorId = this.requireVendor(user);
    if (!UUID_RE.test(orderId.trim())) {
      throw new BadRequestException('WHOLESALE_ORDER_VALIDATION_ERROR: ORDER_ID INVALID');
    }
    const order = await this.orders.rejectForSeller(
      sellerVendorId,
      orderId.trim(),
    );
    return {
      STATUS: 'ORDER_REJECTED_BY_SELLER',
      ORDER: this.serializeOrder(order),
    };
  }

  private serializeOrder(order: {
    id: string;
    buyerVendorId: string;
    sellerVendorId: string;
    status: string;
    currency: string;
    subtotalCents: number;
    carrierName?: string | null;
    trackingNumber?: string | null;
    estimatedDeliveryAt?: Date | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    deliveryConfirmedAt?: Date | null;
    createdAt: Date;
    items: Array<{
      id: string;
      productSkuId: string;
      quantity: number;
      negotiatedTierUnitPrice: number;
      lineTotalCents: number;
    }>;
    buyerVendor?: { id: string; businessName: string | null } | null;
    sellerVendor?: { id: string; businessName: string | null } | null;
    invoice?: {
      id: string;
      invoiceNumber: string;
      status: string;
    } | null;
  }) {
    return {
      ID: order.id,
      BUYER_VENDOR_ID: order.buyerVendorId,
      SELLER_VENDOR_ID: order.sellerVendorId,
      BUYER_VENDOR_NAME: order.buyerVendor?.businessName ?? null,
      SELLER_VENDOR_NAME: order.sellerVendor?.businessName ?? null,
      STATUS: order.status,
      CURRENCY: order.currency,
      SUBTOTAL_CENTS: order.subtotalCents,
      CARRIER_NAME: order.carrierName ?? null,
      TRACKING_NUMBER: order.trackingNumber ?? null,
      ESTIMATED_DELIVERY_AT: order.estimatedDeliveryAt
        ? order.estimatedDeliveryAt.toISOString()
        : null,
      SHIPPED_AT: order.shippedAt ? order.shippedAt.toISOString() : null,
      DELIVERED_AT: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      DELIVERY_CONFIRMED_AT: order.deliveryConfirmedAt
        ? order.deliveryConfirmedAt.toISOString()
        : null,
      INVOICE_ID: order.invoice?.id ?? null,
      INVOICE_NUMBER: order.invoice?.invoiceNumber ?? null,
      ITEMS: order.items.map((item) => ({
        ID: item.id,
        PRODUCT_SKU_ID: item.productSkuId,
        QUANTITY: item.quantity,
        NEGOTIATED_TIER_UNIT_PRICE: item.negotiatedTierUnitPrice,
        LINE_TOTAL_CENTS: item.lineTotalCents,
      })),
      CREATED_AT: order.createdAt.toISOString(),
    };
  }

  private serializeInvoice(invoice: {
    id: string;
    orderId: string;
    settlementLogId?: string | null;
    invoiceNumber: string;
    buyerVendorId: string;
    sellerVendorId: string;
    buyerBusinessName?: string | null;
    sellerBusinessName?: string | null;
    currency: string;
    subtotalCents: number;
    totalCents: number;
    paymentTerms: string;
    lineItems: unknown;
    status: string;
    issuedAt: Date;
    dueAt: Date;
    createdAt?: Date;
  }) {
    return {
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
      ISSUED_AT: invoice.issuedAt.toISOString(),
      DUE_AT: invoice.dueAt.toISOString(),
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
