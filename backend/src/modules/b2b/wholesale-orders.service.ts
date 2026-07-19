import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  VendorBusinessConnectionStatus,
  WholesaleOrderStatus,
  WholesaleProductStatus,
} from '@prisma/client';
import type {
  WholesaleOrderDraftCreateInput,
  WholesaleOrderFulfillmentInput,
} from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';

type PricingTier = { minQty: number; unitPriceCents: number };

function normalizeTiers(raw: unknown): PricingTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null;
      const row = tier as Record<string, unknown>;
      const minQty = Number(row.minQty ?? row.min_qty);
      const unitPriceCents = Number(row.unitPriceCents ?? row.unit_price_cents);
      if (!Number.isFinite(minQty) || !Number.isFinite(unitPriceCents)) return null;
      if (minQty < 1 || unitPriceCents < 0) return null;
      return {
        minQty: Math.floor(minQty),
        unitPriceCents: Math.floor(unitPriceCents),
      };
    })
    .filter((tier): tier is PricingTier => tier !== null)
    .sort((a, b) => a.minQty - b.minQty);
}

function resolveUnitPriceCents(
  quantity: number,
  baseUnitPriceCents: number,
  tiersRaw: unknown,
): number {
  let unit = baseUnitPriceCents;
  for (const tier of normalizeTiers(tiersRaw)) {
    if (quantity >= tier.minQty) unit = tier.unitPriceCents;
  }
  return unit;
}

@Injectable()
export class WholesaleOrdersService {
  private readonly logger = new Logger(WholesaleOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDraft(
    sessionVendorId: string,
    input: WholesaleOrderDraftCreateInput,
  ) {
    if (input.buyer_vendor_id !== sessionVendorId) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=ORDER_DRAFT SESSION=${sessionVendorId} BUYER=${input.buyer_vendor_id}`,
      );
      throw new ForbiddenException('B2B_ERROR: BUYER_VENDOR_MISMATCH');
    }

    if (input.buyer_vendor_id === input.seller_vendor_id) {
      throw new BadRequestException(
        'WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_SELLER_MUST_DIFFER',
      );
    }

    const [buyer, seller] = await Promise.all([
      this.prisma.vendor.findUnique({
        where: { id: input.buyer_vendor_id },
        select: { id: true },
      }),
      this.prisma.vendor.findUnique({
        where: { id: input.seller_vendor_id },
        select: { id: true },
      }),
    ]);

    if (!buyer) {
      throw new NotFoundException('WHOLESALE_ORDER_ERROR: BUYER_VENDOR_NOT_FOUND');
    }
    if (!seller) {
      throw new NotFoundException('WHOLESALE_ORDER_ERROR: SELLER_VENDOR_NOT_FOUND');
    }

    const connection = await this.prisma.vendorBusinessConnection.findFirst({
      where: {
        status: VendorBusinessConnectionStatus.ACCEPTED,
        OR: [
          {
            senderVendorId: input.buyer_vendor_id,
            receiverVendorId: input.seller_vendor_id,
          },
          {
            senderVendorId: input.seller_vendor_id,
            receiverVendorId: input.buyer_vendor_id,
          },
        ],
      },
      select: { id: true },
    });

    if (!connection) {
      throw new ForbiddenException('B2B_ERROR: ACCEPTED_CONNECTION_REQUIRED');
    }

    const skuIds = [...new Set(input.items.map((item) => item.product_sku_id))];
    const products = await this.prisma.wholesaleProduct.findMany({
      where: {
        id: { in: skuIds },
        vendorId: input.seller_vendor_id,
        status: WholesaleProductStatus.ACTIVE,
      },
    });

    if (products.length !== skuIds.length) {
      throw new BadRequestException('WHOLESALE_ORDER_ERROR: PRODUCT_SKU_INVALID');
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const lineRows: Array<{
      productSkuId: string;
      quantity: number;
      negotiatedTierUnitPrice: number;
      lineTotalCents: number;
    }> = [];

    for (const item of input.items) {
      const product = productById.get(item.product_sku_id);
      if (!product) {
        throw new BadRequestException('WHOLESALE_ORDER_ERROR: PRODUCT_SKU_INVALID');
      }

      if (item.quantity < product.moq) {
        throw new BadRequestException(
          `MOQ_GUARD_ACTIVE SKU=${product.id} QTY=${item.quantity} MOQ=${product.moq}`,
        );
      }

      const expectedUnit = resolveUnitPriceCents(
        item.quantity,
        product.unitPriceCents,
        product.pricingTiers,
      );

      if (item.negotiated_tier_unit_price !== expectedUnit) {
        throw new BadRequestException(
          `WHOLESALE_ORDER_ERROR: TIER_PRICE_MISMATCH SKU=${product.id} EXPECTED=${expectedUnit} GOT=${item.negotiated_tier_unit_price}`,
        );
      }

      lineRows.push({
        productSkuId: product.id,
        quantity: item.quantity,
        negotiatedTierUnitPrice: expectedUnit,
        lineTotalCents: expectedUnit * item.quantity,
      });
    }

    const subtotalCents = lineRows.reduce(
      (sum, row) => sum + row.lineTotalCents,
      0,
    );

    this.logger.log(
      `WHOLESALE_PAYLOAD_VALID BUYER=${input.buyer_vendor_id} SELLER=${input.seller_vendor_id} LINES=${lineRows.length} SUBTOTAL_CENTS=${subtotalCents}`,
    );

    const created = await this.prisma.wholesaleOrder.create({
      data: {
        buyerVendorId: input.buyer_vendor_id,
        sellerVendorId: input.seller_vendor_id,
        status: WholesaleOrderStatus.ORDER_DRAFT_INITIALIZED,
        currency: 'USD',
        subtotalCents,
        items: {
          create: lineRows.map((row) => ({
            productSkuId: row.productSkuId,
            quantity: row.quantity,
            negotiatedTierUnitPrice: row.negotiatedTierUnitPrice,
            lineTotalCents: row.lineTotalCents,
          })),
        },
      },
      include: {
        items: true,
        buyerVendor: { select: { id: true, businessName: true } },
        sellerVendor: { select: { id: true, businessName: true } },
      },
    });

    this.logger.log(
      `ORDER_DRAFT_INITIALIZED ID=${created.id} BUYER=${created.buyerVendorId} SELLER=${created.sellerVendorId} LINES=${created.items.length}`,
    );

    return created;
  }

  /** Inbound drafts for the authenticated seller. */
  async listInboundForSeller(sellerVendorId: string) {
    return this.prisma.wholesaleOrder.findMany({
      where: { sellerVendorId },
      include: {
        items: true,
        buyerVendor: { select: { id: true, businessName: true } },
        sellerVendor: { select: { id: true, businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Seller accepts a draft: status → ORDER_ACCEPTED_BY_SELLER and reserve stock.
   */
  async acceptForSeller(sellerVendorId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.wholesaleOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('WHOLESALE_ORDER_ERROR: ORDER_NOT_FOUND');
      }

      if (order.sellerVendorId !== sellerVendorId) {
        this.logger.warn(
          `CROSS_TENANT_LEAK_BLOCKED ACTION=ORDER_ACCEPT SESSION=${sellerVendorId} SELLER=${order.sellerVendorId} ORDER=${orderId}`,
        );
        throw new ForbiddenException('B2B_ERROR: CROSS_TENANT_FORBIDDEN');
      }

      if (order.status !== WholesaleOrderStatus.ORDER_DRAFT_INITIALIZED) {
        throw new ConflictException(
          `WHOLESALE_ORDER_ERROR: INVALID_STATUS CURRENT=${order.status}`,
        );
      }

      if (order.items.length === 0) {
        throw new BadRequestException('WHOLESALE_ORDER_ERROR: ITEMS_REQUIRED');
      }

      for (const item of order.items) {
        const reserved = await tx.wholesaleProduct.updateMany({
          where: {
            id: item.productSkuId,
            vendorId: sellerVendorId,
            status: WholesaleProductStatus.ACTIVE,
            availableQuantity: { gte: item.quantity },
          },
          data: {
            availableQuantity: { decrement: item.quantity },
          },
        });

        if (reserved.count !== 1) {
          const sku = await tx.wholesaleProduct.findUnique({
            where: { id: item.productSkuId },
            select: { availableQuantity: true },
          });
          throw new BadRequestException(
            `WHOLESALE_ORDER_ERROR: INSUFFICIENT_STOCK SKU=${item.productSkuId} NEED=${item.quantity} AVAILABLE=${sku?.availableQuantity ?? 0}`,
          );
        }

        this.logger.log(
          `INVENTORY_RESERVATION_SUCCESS ORDER=${orderId} SKU=${item.productSkuId} QTY=${item.quantity}`,
        );
      }

      const accepted = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: WholesaleOrderStatus.ORDER_ACCEPTED_BY_SELLER },
        include: {
          items: true,
          buyerVendor: { select: { id: true, businessName: true } },
          sellerVendor: { select: { id: true, businessName: true } },
        },
      });

      this.logger.log(
        `ORDER_ACCEPTED_BY_SELLER ID=${accepted.id} SELLER=${sellerVendorId} LINES=${accepted.items.length}`,
      );

      return accepted;
    });
  }

  /** Seller rejects a draft without inventory mutation. */
  async rejectForSeller(sellerVendorId: string, orderId: string) {
    const order = await this.prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      select: { id: true, sellerVendorId: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('WHOLESALE_ORDER_ERROR: ORDER_NOT_FOUND');
    }

    if (order.sellerVendorId !== sellerVendorId) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=ORDER_REJECT SESSION=${sellerVendorId} SELLER=${order.sellerVendorId} ORDER=${orderId}`,
      );
      throw new ForbiddenException('B2B_ERROR: CROSS_TENANT_FORBIDDEN');
    }

    if (order.status !== WholesaleOrderStatus.ORDER_DRAFT_INITIALIZED) {
      throw new ConflictException(
        `WHOLESALE_ORDER_ERROR: INVALID_STATUS CURRENT=${order.status}`,
      );
    }

    const rejected = await this.prisma.wholesaleOrder.update({
      where: { id: orderId },
      data: { status: WholesaleOrderStatus.ORDER_REJECTED_BY_SELLER },
      include: {
        items: true,
        buyerVendor: { select: { id: true, businessName: true } },
        sellerVendor: { select: { id: true, businessName: true } },
      },
    });

    this.logger.log(
      `ORDER_REJECTED_BY_SELLER ID=${rejected.id} SELLER=${sellerVendorId}`,
    );

    return rejected;
  }

  /**
   * Seller ships an accepted order: status → ORDER_SHIPPED_IN_TRANSIT + carrier manifest.
   */
  async fulfillForSeller(
    sellerVendorId: string,
    input: WholesaleOrderFulfillmentInput,
  ) {
    const order = await this.prisma.wholesaleOrder.findUnique({
      where: { id: input.order_id },
      select: { id: true, sellerVendorId: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('WHOLESALE_ORDER_ERROR: ORDER_NOT_FOUND');
    }

    if (order.sellerVendorId !== sellerVendorId) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=ORDER_FULFILL SESSION=${sellerVendorId} SELLER=${order.sellerVendorId} ORDER=${input.order_id}`,
      );
      throw new ForbiddenException('B2B_ERROR: CROSS_TENANT_FORBIDDEN');
    }

    if (order.status !== WholesaleOrderStatus.ORDER_ACCEPTED_BY_SELLER) {
      throw new ConflictException(
        `WHOLESALE_ORDER_ERROR: INVALID_STATUS CURRENT=${order.status}`,
      );
    }

    const estimatedDeliveryAt = new Date(input.estimated_delivery_at);
    if (Number.isNaN(estimatedDeliveryAt.getTime())) {
      throw new BadRequestException(
        'FULFILLMENT_VALIDATION_ERROR: ESTIMATED_DELIVERY_AT INVALID',
      );
    }

    this.logger.log(
      `LOGISTICS_MANIFEST_VALID ORDER=${input.order_id} CARRIER=${input.carrier_name.toUpperCase()} TRACKING=${input.tracking_number}`,
    );

    const shipped = await this.prisma.wholesaleOrder.update({
      where: { id: input.order_id },
      data: {
        status: WholesaleOrderStatus.ORDER_SHIPPED_IN_TRANSIT,
        carrierName: input.carrier_name,
        trackingNumber: input.tracking_number,
        estimatedDeliveryAt,
        shippedAt: new Date(),
      },
      include: {
        items: true,
        buyerVendor: { select: { id: true, businessName: true } },
        sellerVendor: { select: { id: true, businessName: true } },
      },
    });

    this.logger.log(
      `ORDER_FULFILLMENT_TRACKED ID=${shipped.id} STATUS=${shipped.status} CARRIER=${shipped.carrierName} TRACKING=${shipped.trackingNumber}`,
    );

    return shipped;
  }
}
