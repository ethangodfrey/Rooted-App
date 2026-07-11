import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface InventoryLineRef {
  productId: string;
  eventId: string;
  quantity: number;
  customerId: string;
}

@Injectable()
export class CheckoutInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soft-lock presale units for Stripe checkout (reserved_quantity only).
   * Presale stock is decremented when payment is confirmed via webhook.
   */
  async reserveForStripeCheckout(
    tx: Prisma.TransactionClient,
    lines: InventoryLineRef[],
  ): Promise<void> {
    for (const line of lines) {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        update public.product_event_availability
        set reserved_quantity = reserved_quantity + ${line.quantity}
        where product_id = ${line.productId}::uuid
          and event_id = ${line.eventId}::uuid
          and (available_quantity_presale - reserved_quantity) >= ${line.quantity}
        returning id
      `);

      if (rows.length !== 1) {
        throw new BadRequestException(
          `Insufficient presale inventory for product ${line.productId}.`,
        );
      }

      await tx.$executeRaw`
        insert into public.inventory_holds (
          product_id, event_id, customer_id, quantity, hold_type, expires_at
        ) values (
          ${line.productId}::uuid,
          ${line.eventId}::uuid,
          ${line.customerId}::uuid,
          ${line.quantity},
          'checkout',
          now() + interval '24 hours'
        )
      `;
    }
  }

  /** Finalize inventory after successful Stripe payment (permanent sale). */
  async finalizePaidOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    customerId: string,
  ): Promise<void> {
    const items = await tx.$queryRaw<
      Array<{ product_id: string; event_id: string; quantity: number }>
    >`
      select oi.product_id, o.event_id, oi.quantity
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.shoppers s on s.id = o.shopper_id
      where o.id = ${orderId}::uuid
        and s.user_id = ${customerId}::uuid
        and oi.product_id is not null
        and o.event_id is not null
    `;

    for (const item of items) {
      const decremented = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        update public.product_event_availability
        set
          available_quantity_presale = available_quantity_presale - ${item.quantity},
          reserved_quantity = greatest(0, reserved_quantity - ${item.quantity})
        where product_id = ${item.product_id}::uuid
          and event_id = ${item.event_id}::uuid
          and available_quantity_presale >= ${item.quantity}
        returning id
      `);

      if (decremented.length !== 1) {
        throw new BadRequestException(
          `Could not finalize inventory for product ${item.product_id}.`,
        );
      }

      await tx.$executeRaw`
        delete from public.inventory_holds
        where product_id = ${item.product_id}::uuid
          and event_id = ${item.event_id}::uuid
          and customer_id = ${customerId}::uuid
          and hold_type = 'checkout'
          and quantity = ${item.quantity}
      `;
    }
  }

  /**
   * Compensation path when Stripe checkout expires or webhook processing fails.
   * Releases reserved_quantity locks without decrementing presale stock.
   */
  async compensateStripeCheckout(
    tx: Prisma.TransactionClient,
    orderId: string,
    customerId: string,
  ): Promise<void> {
    const items = await tx.$queryRaw<
      Array<{ product_id: string; event_id: string; quantity: number }>
    >`
      select oi.product_id, o.event_id, oi.quantity
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.shoppers s on s.id = o.shopper_id
      where o.id = ${orderId}::uuid
        and s.user_id = ${customerId}::uuid
        and oi.product_id is not null
        and o.event_id is not null
    `;

    for (const item of items) {
      await tx.$executeRaw`
        update public.product_event_availability
        set reserved_quantity = greatest(0, reserved_quantity - ${item.quantity})
        where product_id = ${item.product_id}::uuid
          and event_id = ${item.event_id}::uuid
      `;

      await tx.$executeRaw`
        delete from public.inventory_holds
        where product_id = ${item.product_id}::uuid
          and event_id = ${item.event_id}::uuid
          and customer_id = ${customerId}::uuid
          and hold_type = 'checkout'
          and quantity = ${item.quantity}
      `;
    }

    await tx.$executeRaw`
      update public.orders
      set
        payment_status = 'unpaid',
        order_status = 'cancelled',
        updated_at = now()
      where id = ${orderId}::uuid
        and payment_status = 'stripe_pending'
    `;
  }

  /** Immediate presale decrement for pay-at-pickup checkout. */
  async decrementPresale(
    tx: Prisma.TransactionClient,
    line: InventoryLineRef,
    productName: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      update public.product_event_availability
      set available_quantity_presale = available_quantity_presale - ${line.quantity}
      where product_id = ${line.productId}::uuid
        and event_id = ${line.eventId}::uuid
        and (available_quantity_presale - reserved_quantity) >= ${line.quantity}
      returning id
    `);

    if (rows.length !== 1) {
      throw new BadRequestException(`${productName} is no longer available in that quantity.`);
    }
  }
}
