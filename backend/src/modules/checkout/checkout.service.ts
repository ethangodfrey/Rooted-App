import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Event, type Product } from '@prisma/client';
import { randomInt } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import type { CreateCheckoutDto } from './dto/create-checkout.dto';

const PICKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PICKUP_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const PLATFORM_FEE_BPS = 500;

interface BasketLine {
  productId: string;
  eventId: string;
  quantity: number;
  notes: string | null;
  product: Pick<Product, 'id' | 'vendorId' | 'name' | 'price'>;
  event: Pick<Event, 'id' | 'name' | 'startDatetime' | 'endDatetime' | 'address' | 'city' | 'state'>;
}

interface CheckoutGroup {
  vendorId: string;
  eventId: string;
  event: BasketLine['event'];
  lines: BasketLine[];
  subtotal: number;
}

interface CheckoutReceiptItem {
  productId: string;
  name: string;
  quantity: number;
  itemPrice: number;
  lineTotal: number;
}

interface CheckoutReceipt {
  id: string;
  vendorId: string;
  vendorName: string | null;
  eventId: string;
  eventName: string;
  fulfillmentWindowStart: string;
  fulfillmentWindowEnd: string;
  pickupCode: string;
  boothDetails: string | null;
  subtotal: number;
  platformFee: number;
  total: number;
  items: CheckoutReceiptItem[];
}

export interface CheckoutResult {
  transactionId: string;
  totalAmount: number;
  status: string;
  orders: CheckoutReceipt[];
}

type CheckoutTx = Prisma.TransactionClient;

function pickupCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += PICKUP_CODE_ALPHABET[randomInt(PICKUP_CODE_ALPHABET.length)];
  }
  return code;
}

function groupKey(vendorId: string, eventId: string): string {
  return `${vendorId}:${eventId}`;
}

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async createCheckout(user: AuthenticatedUser, dto: CreateCheckoutDto): Promise<CheckoutResult> {
    if (user.role !== 'shopper') {
      throw new BadRequestException('Only customers can check out.');
    }

    return this.prisma.$transaction(async (tx) => {
      const shopper = await tx.shopper.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!shopper) throw new BadRequestException('Customer profile not found.');

      const lines = await this.loadBasketLines(tx, dto);
      const groups = this.groupLines(lines);
      const totalAmount = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

      for (const line of lines) {
        await this.decrementInventory(tx, line);
      }

      const transaction = await tx.transaction.create({
        data: {
          customerId: user.id,
          stripePaymentIntentId: dto.stripePaymentIntentId ?? null,
          totalAmount,
          status: dto.stripePaymentIntentId ? 'authorized' : 'captured',
        },
      });

      const vendorIds = [...new Set(groups.map((group) => group.vendorId))];
      const vendors = await tx.vendor.findMany({
        where: { id: { in: vendorIds } },
        select: { id: true, businessName: true },
      });
      const vendorName = new Map(vendors.map((vendor) => [vendor.id, vendor.businessName]));

      const vendorEvents = await tx.vendorEvent.findMany({
        where: {
          OR: groups.map((group) => ({
            vendorId: group.vendorId,
            eventId: group.eventId,
          })),
        },
        select: { vendorId: true, eventId: true, boothDetails: true },
      });
      const boothByGroup = new Map(
        vendorEvents.map((row) => [groupKey(row.vendorId, row.eventId), row.boothDetails]),
      );

      const orders: CheckoutReceipt[] = [];
      for (const group of groups) {
        const platformFee = Math.round((group.subtotal * PLATFORM_FEE_BPS) / 10_000);
        const code = await this.uniquePickupCode(tx);
        const order = await tx.order.create({
          data: {
            transactionId: transaction.id,
            shopperId: shopper.id,
            vendorId: group.vendorId,
            eventId: group.eventId,
            orderType: 'event_pickup',
            orderStatus: 'pending',
            paymentStatus: dto.stripePaymentIntentId ? 'stripe_pending' : 'paid_at_pickup',
            fulfillmentType: 'pickup',
            subtotal: group.subtotal,
            tax: 0,
            total: group.subtotal,
            platformFee,
            pickupCode: code,
            fulfillmentWindowStart: group.event.startDatetime,
            fulfillmentWindowEnd: group.event.endDatetime,
            stripePaymentIntentId: dto.stripePaymentIntentId ?? null,
            orderItems: {
              create: group.lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
                itemPrice: line.product.price,
                itemTitle: line.product.name,
                customizationData: line.notes ? { notes: line.notes } : undefined,
              })),
            },
          },
          select: { id: true },
        });

        orders.push({
          id: order.id,
          vendorId: group.vendorId,
          vendorName: vendorName.get(group.vendorId) ?? null,
          eventId: group.eventId,
          eventName: group.event.name,
          fulfillmentWindowStart: group.event.startDatetime.toISOString(),
          fulfillmentWindowEnd: group.event.endDatetime.toISOString(),
          pickupCode: code,
          boothDetails: boothByGroup.get(groupKey(group.vendorId, group.eventId)) ?? null,
          subtotal: group.subtotal,
          platformFee,
          total: group.subtotal,
          items: group.lines.map((line) => ({
            productId: line.productId,
            name: line.product.name,
            quantity: line.quantity,
            itemPrice: line.product.price,
            lineTotal: line.product.price * line.quantity,
          })),
        });
      }

      return {
        transactionId: transaction.id,
        totalAmount,
        status: transaction.status,
        orders,
      };
    });
  }

  async getCheckout(user: AuthenticatedUser, transactionId: string): Promise<CheckoutResult> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, customerId: user.id },
      include: {
        orders: {
          include: {
            vendor: { select: { businessName: true } },
            event: {
              select: {
                id: true,
                name: true,
                startDatetime: true,
                endDatetime: true,
              },
            },
            orderItems: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Checkout transaction not found.');

    const vendorEvents = await this.prisma.vendorEvent.findMany({
      where: {
        OR: transaction.orders
          .filter((order) => order.eventId != null)
          .map((order) => ({ vendorId: order.vendorId, eventId: order.eventId! })),
      },
      select: { vendorId: true, eventId: true, boothDetails: true },
    });
    const boothByGroup = new Map(
      vendorEvents.map((row) => [groupKey(row.vendorId, row.eventId), row.boothDetails]),
    );

    return {
      transactionId: transaction.id,
      totalAmount: transaction.totalAmount,
      status: transaction.status,
      orders: transaction.orders.map((order) => ({
        id: order.id,
        vendorId: order.vendorId,
        vendorName: order.vendor.businessName,
        eventId: order.eventId ?? '',
        eventName: order.event?.name ?? 'Pickup event',
        fulfillmentWindowStart:
          order.fulfillmentWindowStart?.toISOString() ??
          order.event?.startDatetime.toISOString() ??
          transaction.createdAt.toISOString(),
        fulfillmentWindowEnd:
          order.fulfillmentWindowEnd?.toISOString() ??
          order.event?.endDatetime.toISOString() ??
          transaction.createdAt.toISOString(),
        pickupCode: order.pickupCode ?? '',
        boothDetails: order.eventId
          ? boothByGroup.get(groupKey(order.vendorId, order.eventId)) ?? null
          : null,
        subtotal: order.subtotal,
        platformFee: order.platformFee,
        total: order.total,
        items: order.orderItems.map((item) => ({
          productId: item.productId ?? '',
          name: item.product?.name ?? item.itemTitle ?? 'Item',
          quantity: item.quantity,
          itemPrice: item.itemPrice,
          lineTotal: item.itemPrice * item.quantity,
        })),
      })),
    };
  }

  private async loadBasketLines(tx: CheckoutTx, dto: CreateCheckoutDto): Promise<BasketLine[]> {
    const compacted = new Map<string, { productId: string; eventId: string; quantity: number; notes: string | null }>();
    for (const item of dto.items) {
      const key = `${item.productId}:${item.eventId}`;
      const current = compacted.get(key);
      compacted.set(key, {
        productId: item.productId,
        eventId: item.eventId,
        quantity: (current?.quantity ?? 0) + item.quantity,
        notes: [current?.notes, item.notes?.trim()].filter(Boolean).join('\n') || null,
      });
    }

    const pairs = [...compacted.values()];
    const products = await tx.product.findMany({
      where: { id: { in: pairs.map((item) => item.productId) } },
      select: { id: true, vendorId: true, name: true, price: true },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    const availability = await tx.productEventAvailability.findMany({
      where: {
        OR: pairs.map((item) => ({ productId: item.productId, eventId: item.eventId })),
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDatetime: true,
            endDatetime: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });
    const availabilityByPair = new Map(
      availability.map((row) => [`${row.productId}:${row.eventId}`, row]),
    );

    return pairs.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) throw new NotFoundException(`Product not found: ${item.productId}`);
      const available = availabilityByPair.get(`${item.productId}:${item.eventId}`);
      if (!available) {
        throw new BadRequestException(`${product.name} is not available for the selected event.`);
      }
      const remaining = available.availableQuantityPresale - available.reservedQuantity;
      if (remaining < item.quantity) {
        throw new BadRequestException(`Only ${Math.max(remaining, 0)} ${product.name} left.`);
      }

      return {
        ...item,
        product,
        event: available.event,
      };
    });
  }

  private groupLines(lines: BasketLine[]): CheckoutGroup[] {
    const groups = new Map<string, CheckoutGroup>();
    for (const line of lines) {
      const key = groupKey(line.product.vendorId, line.eventId);
      const current = groups.get(key);
      if (current) {
        current.lines.push(line);
        current.subtotal += line.product.price * line.quantity;
      } else {
        groups.set(key, {
          vendorId: line.product.vendorId,
          eventId: line.eventId,
          event: line.event,
          lines: [line],
          subtotal: line.product.price * line.quantity,
        });
      }
    }
    return [...groups.values()];
  }

  private async decrementInventory(tx: CheckoutTx, line: BasketLine): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      update public.product_event_availability
      set available_quantity_presale = available_quantity_presale - ${line.quantity}
      where product_id = ${line.productId}::uuid
        and event_id = ${line.eventId}::uuid
        and (available_quantity_presale - reserved_quantity) >= ${line.quantity}
      returning id
    `);

    if (rows.length !== 1) {
      throw new BadRequestException(`${line.product.name} is no longer available in that quantity.`);
    }
  }

  private async uniquePickupCode(tx: CheckoutTx): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = pickupCode();
      if (!PICKUP_CODE_PATTERN.test(code)) {
        throw new BadRequestException('Generated pickup code was invalid. Please retry.');
      }
      const existing = await tx.order.findUnique({
        where: { pickupCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not allocate a pickup code. Please retry.');
  }
}
