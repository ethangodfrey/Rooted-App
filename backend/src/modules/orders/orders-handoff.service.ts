import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { PICKUP_CODE_REGEX } from './dto/verify-handoff.dto';

export type VerifyHandoffSuccess = {
  STATUS: 'SUCCESS';
  CODE: string;
};

export type VerifyHandoffError = {
  STATUS: 'ERROR';
  REASON: 'INVALID_OR_ALREADY_REDEEMED';
};

export type VerifyHandoffResponse = VerifyHandoffSuccess | VerifyHandoffError;

type PreorderRow = {
  id: string;
  shopper_id: string;
  vendor_id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_amount: number | string;
  pickup_code: string;
};

@Injectable()
export class OrdersHandoffService {
  private readonly logger = new Logger(OrdersHandoffService.name);

  constructor(private readonly prisma: PrismaService) {}

  async verifyHandoff(
    user: AuthenticatedUser,
    rawCode: string,
  ): Promise<VerifyHandoffResponse> {
    const code = rawCode.trim().toUpperCase();
    if (!PICKUP_CODE_REGEX.test(code)) {
      return { STATUS: 'ERROR', REASON: 'INVALID_OR_ALREADY_REDEEMED' };
    }

    this.logger.log(`VERIFY_HANDOFF: CODE=${code} VENDOR=${user.id}`);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<PreorderRow[]>`
          select
            id,
            shopper_id,
            vendor_id,
            status::text as status,
            payment_method::text as payment_method,
            payment_status::text as payment_status,
            total_amount,
            pickup_code
          from public.preorder_orders
          where pickup_code = ${code}
            and vendor_id = ${user.id}::uuid
          for update
          limit 1
        `;

        const order = rows[0];
        if (!order || order.status !== 'PENDING_PICKUP') {
          return null;
        }

        const updated = await tx.$queryRaw<PreorderRow[]>`
          update public.preorder_orders
          set
            status = 'COMPLETED'::public.preorder_status,
            payment_status = case
              when payment_method = 'PAY_AT_HANDOFF'::public.preorder_payment_method
                then 'PAID'::public.preorder_payment_status
              else payment_status
            end,
            completed_at = now()
          where id = ${order.id}::uuid
            and status = 'PENDING_PICKUP'::public.preorder_status
          returning
            id,
            shopper_id,
            vendor_id,
            status::text as status,
            payment_method::text as payment_method,
            payment_status::text as payment_status,
            total_amount,
            pickup_code
        `;

        const completed = updated[0];
        if (!completed) {
          return null;
        }

        const amount = Number(completed.total_amount);
        const source =
          completed.payment_method === 'PAY_AT_HANDOFF' ? 'CASH_HANDOFF' : 'STRIPE_NATIVE';

        if (Number.isFinite(amount) && amount >= 0) {
          await tx.$executeRaw`
            insert into public.historical_sales_metrics (
              vendor_id,
              source,
              amount,
              recorded_at
            ) values (
              ${completed.vendor_id}::uuid,
              ${source}::public.pos_sales_source,
              ${amount},
              now()
            )
          `;
        }

        await this.writeHandoffNotifications(tx, completed);

        return completed;
      });

      if (!result) {
        return { STATUS: 'ERROR', REASON: 'INVALID_OR_ALREADY_REDEEMED' };
      }

      this.logger.log(`VERIFY_HANDOFF: SUCCESS CODE=${result.pickup_code}`);
      return { STATUS: 'SUCCESS', CODE: result.pickup_code };
    } catch (err) {
      this.logger.error(
        `VERIFY_HANDOFF: FAILED ${err instanceof Error ? err.message : 'UNKNOWN'}`,
      );
      return { STATUS: 'ERROR', REASON: 'INVALID_OR_ALREADY_REDEEMED' };
    }
  }

  private async writeHandoffNotifications(
    tx: {
      $executeRaw: PrismaService['$executeRaw'];
    },
    order: PreorderRow,
  ): Promise<void> {
    const title = 'ORDER_COMPLETED';
    const body = `PRE-ORDER ${order.pickup_code} HANDOFF VERIFIED · COMPLETE TRANSITION`;

    try {
      await tx.$executeRaw`
        select public.enqueue_notification(
          ${order.shopper_id}::uuid,
          ${title},
          ${body},
          'ORDER_STATUS'::public.notification_type
        )
      `;
      await tx.$executeRaw`
        select public.enqueue_notification(
          ${order.vendor_id}::uuid,
          ${title},
          ${body},
          'ORDER_STATUS'::public.notification_type
        )
      `;
    } catch {
      // notification_logs / enqueue_notification may not be applied yet — complete handoff anyway
      this.logger.warn('VERIFY_HANDOFF: NOTIFICATION_WRITE_SKIPPED');
      try {
        await tx.$executeRaw`
          insert into public.notification_logs (
            user_id, title, body, notification_type
          ) values (
            ${order.shopper_id}::uuid,
            ${title},
            ${body},
            'ORDER_STATUS'::public.notification_type
          )
        `;
        await tx.$executeRaw`
          insert into public.notification_logs (
            user_id, title, body, notification_type
          ) values (
            ${order.vendor_id}::uuid,
            ${title},
            ${body},
            'ORDER_STATUS'::public.notification_type
          )
        `;
      } catch {
        this.logger.warn('VERIFY_HANDOFF: NOTIFICATION_LOGS_UNAVAILABLE');
      }
    }
  }
}
