import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import type { CreateOrderDto } from './dto/create-order.dto';

export type CreateOrderResponse = {
  STATUS: 'SUCCESS';
  ORDER_ID: string;
  PICKUP_CODE: string;
  STATUS_FIELD: string;
  TOTAL_AMOUNT: number;
  SHOPPER_ID: string;
  VENDOR_ID: string;
};

type PreorderCreatedRow = {
  id: string;
  shopper_id: string;
  vendor_id: string;
  status: string;
  pickup_code: string;
  total_amount: number | string;
};

/**
 * Transaction entry for pre-order reservations.
 * Mirrors public.create_preorder_pickup so stock triggers fire on item insert.
 */
@Injectable()
export class OrdersCreateService {
  private readonly logger = new Logger(OrdersCreateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(
    user: AuthenticatedUser,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResponse> {
    const quantity = dto.quantity;
    const paymentMethod = dto.payment_method ?? 'PAY_AT_HANDOFF';
    const fulfillmentLabel =
      dto.fulfillment_label?.trim() || 'PICKUP AT STOREFRONT';

    this.logger.log(
      `CREATE_ORDER: SHOPPER=${user.id} PRODUCT=${dto.product_id} QTY=${quantity}`,
    );

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const products = await tx.$queryRaw<
          Array<{ price: number | string; product_vendor: string }>
        >`
          select p.price::numeric as price, v.user_id as product_vendor
          from public.products p
          join public.vendors v on v.id = p.vendor_id
          where p.id = ${dto.product_id}::uuid
            and p.status = 'active'
          limit 1
        `;

        const product = products[0];
        if (!product) {
          throw new NotFoundException('Product not found or inactive');
        }
        if (product.product_vendor !== dto.vendor_user_id) {
          throw new BadRequestException('Vendor mismatch for product');
        }

        const vendorOk = await tx.$queryRaw<Array<{ id: string }>>`
          select id
          from public.profiles
          where id = ${dto.vendor_user_id}::uuid
            and role in ('vendor', 'farmer')
          limit 1
        `;
        if (!vendorOk[0]) {
          throw new BadRequestException('Vendor profile must be vendor or farmer');
        }

        await tx.$executeRaw`
          insert into public.profiles (id, role)
          values (${user.id}::uuid, 'shopper')
          on conflict (id) do nothing
        `;

        const payStatus =
          paymentMethod === 'STRIPE_ONLINE' ? 'PAID' : 'PENDING';
        const unitPrice = Number(product.price);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException('Invalid product price');
        }
        const totalAmount = Math.round(unitPrice * quantity * 100) / 100;

        const orders = await tx.$queryRaw<PreorderCreatedRow[]>`
          insert into public.preorder_orders (
            shopper_id,
            vendor_id,
            event_id,
            status,
            payment_method,
            payment_status,
            total_amount,
            fulfillment_label
          ) values (
            ${user.id}::uuid,
            ${dto.vendor_user_id}::uuid,
            ${dto.event_id ?? null}::uuid,
            'PENDING_PICKUP'::public.preorder_status,
            ${paymentMethod}::public.preorder_payment_method,
            ${payStatus}::public.preorder_payment_status,
            ${totalAmount},
            ${fulfillmentLabel}
          )
          returning
            id,
            shopper_id,
            vendor_id,
            status::text as status,
            pickup_code,
            total_amount
        `;

        const order = orders[0];
        if (!order) {
          throw new BadRequestException('Failed to create preorder');
        }

        await tx.$executeRaw`
          insert into public.preorder_order_items (
            order_id, product_id, quantity, unit_price
          ) values (
            ${order.id}::uuid,
            ${dto.product_id}::uuid,
            ${quantity},
            ${unitPrice}
          )
        `;

        return order;
      });

      this.logger.log(
        `CREATE_ORDER: SUCCESS ORDER=${created.id} CODE=${created.pickup_code}`,
      );

      return {
        STATUS: 'SUCCESS',
        ORDER_ID: created.id,
        PICKUP_CODE: created.pickup_code,
        STATUS_FIELD: created.status,
        TOTAL_AMOUNT: Number(created.total_amount),
        SHOPPER_ID: created.shopper_id,
        VENDOR_ID: created.vendor_id,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      this.logger.error(`CREATE_ORDER: FAIL ${message}`);
      if (/Insufficient stock/i.test(message)) {
        throw new BadRequestException(message);
      }
      throw new BadRequestException(`ORDER_CREATE_FAILED: ${message}`);
    }
  }
}
