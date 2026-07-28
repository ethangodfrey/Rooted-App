import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ChefProcurementOrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentClearingService } from '../financial/payment-clearing.service';
import { PaymentsGatewayService } from '../stripe/payments-gateway.service';

export type ChefProcurementCartLine = {
  productId: string;
  quantity: number;
};

function generatePickupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

@Injectable()
export class ChefProcurementService implements OnModuleInit {
  private readonly logger = new Logger(ChefProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentsGatewayService,
    private readonly clearing: PaymentClearingService,
  ) {}

  onModuleInit(): void {
    this.logger.log('B2B_WHOLESALE_ACTIVE');
    this.logger.log('CHEF_PROCUREMENT_INITIALIZED');
  }

  async listCatalog(input?: { q?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(input?.limit ?? 40, 1), 100);
    const q = input?.q?.trim() ?? '';

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        name: string;
        description: string | null;
        category: string | null;
        price: number;
        wholesale_price_cents: number | null;
        moq_quantity: number | null;
        media_urls: string[] | null;
        business_name: string | null;
      }>
    >(Prisma.sql`
      SELECT
        p.id,
        p.vendor_id,
        p.name,
        p.description,
        p.category,
        p.price,
        p.wholesale_price_cents,
        p.moq_quantity,
        p.media_urls,
        v.business_name
      FROM public.products p
      JOIN public.vendors v ON v.id = p.vendor_id
      WHERE p.is_wholesale_eligible = true
        AND p.status = 'active'
        AND coalesce(v.approval_status, 'approved') = 'approved'
        AND (
          ${q} = ''
          OR p.name ILIKE ${'%' + q + '%'}
          OR coalesce(p.category, '') ILIKE ${'%' + q + '%'}
          OR coalesce(v.business_name, '') ILIKE ${'%' + q + '%'}
        )
      ORDER BY v.business_name ASC NULLS LAST, p.name ASC
      LIMIT ${limit}
    `);

    this.logger.log(`B2B_WHOLESALE_ACTIVE CATALOG_COUNT=${rows.length}`);

    return {
      STATUS: 'B2B_WHOLESALE_ACTIVE',
      ITEMS: rows.map((row) => {
        const moq = Math.max(1, Number(row.moq_quantity) || 1);
        const wholesale =
          row.wholesale_price_cents != null
            ? Number(row.wholesale_price_cents)
            : Number(row.price);
        return {
          id: row.id,
          vendorId: row.vendor_id,
          vendorName: row.business_name,
          name: row.name,
          description: row.description,
          category: row.category,
          retailPriceCents: Number(row.price),
          wholesalePriceCents: wholesale,
          moqQuantity: moq,
          mediaUrls: row.media_urls ?? [],
          locationLabel: null as string | null,
        };
      }),
      COUNT: rows.length,
    };
  }

  async checkout(input: {
    buyerUserId: string;
    buyerRole: 'chef' | 'vendor';
    buyerVendorId?: string | null;
    lines: ChefProcurementCartLine[];
    successUrl?: string;
    cancelUrl?: string;
  }) {
    if (!input.lines?.length) {
      throw new BadRequestException('CART_EMPTY');
    }

    const productIds = [...new Set(input.lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isWholesaleEligible: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('WHOLESALE_PRODUCT_NOT_FOUND');
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const sellerIds = new Set(products.map((p) => p.vendorId));
    if (sellerIds.size !== 1) {
      throw new BadRequestException('SINGLE_SELLER_CART_REQUIRED');
    }
    const sellerVendorId = [...sellerIds][0]!;

    const itemRows: Array<{
      productId: string;
      productName: string;
      quantity: number;
      moqQuantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }> = [];

    for (const line of input.lines) {
      const product = byId.get(line.productId);
      if (!product) throw new BadRequestException('WHOLESALE_PRODUCT_NOT_FOUND');
      const qty = Math.floor(Number(line.quantity));
      const moq = Math.max(1, product.moqQuantity ?? 1);
      if (!Number.isFinite(qty) || qty < 1) {
        throw new BadRequestException('QUANTITY_INVALID');
      }
      if (qty < moq) {
        throw new BadRequestException(
          `MOQ_NOT_MET PRODUCT=${product.id} MOQ=${moq} QTY=${qty}`,
        );
      }
      const unit =
        product.wholesalePriceCents != null
          ? product.wholesalePriceCents
          : product.price;
      itemRows.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        moqQuantity: moq,
        unitPriceCents: unit,
        lineTotalCents: unit * qty,
      });
    }

    const subtotalCents = itemRows.reduce((sum, row) => sum + row.lineTotalCents, 0);
    const pickupCode = generatePickupCode();

    const order = await this.prisma.chefProcurementOrder.create({
      data: {
        buyerUserId: input.buyerUserId,
        buyerRole: input.buyerRole,
        buyerVendorId: input.buyerVendorId ?? null,
        sellerVendorId,
        status: ChefProcurementOrderStatus.AWAITING_PAYMENT,
        subtotalCents,
        pickupCode,
        items: {
          create: itemRows.map((row) => ({
            productId: row.productId,
            productName: row.productName,
            quantity: row.quantity,
            moqQuantity: row.moqQuantity,
            unitPriceCents: row.unitPriceCents,
            lineTotalCents: row.lineTotalCents,
          })),
        },
      },
      include: { items: true },
    });

    const checkout = await this.gateway.createCheckoutSession({
      referenceId: order.id,
      amount: subtotalCents,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    await this.prisma.chefProcurementOrder.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: checkout.SESSION_ID },
    });

    this.logger.log(
      `CHEF_PROCUREMENT_INITIALIZED ORDER=${order.id} SUBTOTAL=${subtotalCents} SELLER=${sellerVendorId}`,
    );

    return {
      STATUS: 'CHEF_PROCUREMENT_INITIALIZED',
      ORDER_ID: order.id,
      PICKUP_CODE: pickupCode,
      SUBTOTAL_CENTS: subtotalCents,
      CHECKOUT_URL: checkout.URL,
      SESSION_ID: checkout.SESSION_ID,
      ESCROW: 'HELD_IN_ESCROW_PENDING_PAYMENT',
    };
  }

  async markHeldInEscrow(orderId: string, escrowTransactionId: string) {
    await this.prisma.chefProcurementOrder.updateMany({
      where: {
        id: orderId,
        status: {
          in: [
            ChefProcurementOrderStatus.AWAITING_PAYMENT,
            ChefProcurementOrderStatus.HELD_IN_ESCROW,
          ],
        },
      },
      data: {
        status: ChefProcurementOrderStatus.HELD_IN_ESCROW,
        escrowTransactionId,
        paidAt: new Date(),
      },
    });
    await this.prisma.chefProcurementOrder.updateMany({
      where: { id: orderId, status: ChefProcurementOrderStatus.HELD_IN_ESCROW },
      data: { status: ChefProcurementOrderStatus.READY_FOR_PICKUP },
    });
    this.logger.log(`B2B_WHOLESALE_ACTIVE ACTION=HELD_IN_ESCROW ORDER=${orderId}`);
  }

  async confirmPickup(input: {
    orderId: string;
    pickupCode: string;
    actorUserId: string;
    actorRole: string;
    actorVendorId?: string | null;
  }) {
    const order = await this.prisma.chefProcurementOrder.findUnique({
      where: { id: input.orderId },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');

    const code = input.pickupCode.trim().toUpperCase();
    if (!code || code !== order.pickupCode.toUpperCase()) {
      throw new BadRequestException('PICKUP_CODE_INVALID');
    }

    const isBuyer = order.buyerUserId === input.actorUserId;
    const isSeller =
      input.actorVendorId != null && input.actorVendorId === order.sellerVendorId;
    if (!isBuyer && !isSeller && input.actorRole !== 'admin') {
      throw new ForbiddenException('NOT_ORDER_PARTY');
    }

    if (order.status === ChefProcurementOrderStatus.SETTLED) {
      return {
        STATUS: 'B2B_WHOLESALE_ACTIVE',
        ACTION: 'ALREADY_SETTLED',
        ORDER_ID: order.id,
      };
    }

    if (
      order.status !== ChefProcurementOrderStatus.HELD_IN_ESCROW &&
      order.status !== ChefProcurementOrderStatus.READY_FOR_PICKUP
    ) {
      throw new BadRequestException(`ORDER_STATUS_INVALID STATUS=${order.status}`);
    }

    await this.clearing.releaseEscrow({ chefProcurementOrderId: order.id });

    await this.prisma.chefProcurementOrder.update({
      where: { id: order.id },
      data: {
        status: ChefProcurementOrderStatus.SETTLED,
        settledAt: new Date(),
      },
    });

    this.logger.log(
      `B2B_WHOLESALE_ACTIVE ACTION=SETTLED ORDER=${order.id} PICKUP_VERIFIED=true`,
    );

    return {
      STATUS: 'B2B_WHOLESALE_ACTIVE',
      ACTION: 'SETTLED',
      ORDER_ID: order.id,
      PICKUP_VERIFIED: true,
    };
  }

  async listMyOrders(buyerUserId: string) {
    const orders = await this.prisma.chefProcurementOrder.findMany({
      where: { buyerUserId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return {
      STATUS: 'CHEF_PROCUREMENT_INITIALIZED',
      ITEMS: orders,
      COUNT: orders.length,
    };
  }
}
