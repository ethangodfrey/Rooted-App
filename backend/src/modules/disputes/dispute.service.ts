/**
 * DisputeService — freeze escrow, admin refund / dismiss.
 * Telemetry: DISPUTE_ENGINE_INITIALIZED, ESCROW_FROZEN_ACTIVE
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentClearingService } from '../financial/payment-clearing.service';
import { NotificationService } from '../notifications/notification.service';
import { StripeService } from '../stripe/stripe.service';
import {
  formatDisputeEngineInitializedLog,
  formatEscrowFrozenActiveLog,
  isOpenDisputeStatus,
} from './dispute.util';

@Injectable()
export class DisputeService implements OnModuleInit {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clearing: PaymentClearingService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatDisputeEngineInitializedLog());
    this.logger.log(formatEscrowFrozenActiveLog());
  }

  /**
   * Raise a dispute and instantly freeze HELD_IN_ESCROW → FROZEN.
   */
  async raiseDispute(input: {
    transactionId: string;
    reason: string;
    initiatorId: string;
  }) {
    const transactionId = input.transactionId?.trim();
    const reason = input.reason?.trim();
    if (!transactionId) throw new BadRequestException('TRANSACTION_ID_REQUIRED');
    if (!reason) throw new BadRequestException('REASON_REQUIRED');
    if (!input.initiatorId?.trim()) {
      throw new BadRequestException('INITIATOR_REQUIRED');
    }

    const tx = await this.loadTransaction(transactionId);
    if (tx.status === 'FROZEN') {
      const existing = await this.findOpenDispute(transactionId);
      if (existing) {
        return {
          STATUS: 'ESCROW_FROZEN_ACTIVE',
          ACTION: 'ALREADY_FROZEN',
          DISPUTE_ID: existing.id,
          TRANSACTION_ID: transactionId,
          DISPUTE_STATUS: existing.status,
        };
      }
    }
    if (tx.status !== 'HELD_IN_ESCROW') {
      throw new BadRequestException('ESCROW_NOT_DISPUTABLE');
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.financial_transactions
      SET
        status = 'FROZEN'::public.financial_transaction_status,
        updated_at = NOW()
      WHERE id = ${transactionId}::uuid
        AND status = 'HELD_IN_ESCROW'::public.financial_transaction_status
    `);

    const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.disputes (
        transaction_id, initiator_id, reason, status, metadata
      ) VALUES (
        ${transactionId}::uuid,
        ${input.initiatorId}::uuid,
        ${reason},
        'OPEN'::public.dispute_status,
        ${JSON.stringify({
          transactionType: tx.transaction_type,
          referenceId: tx.reference_id,
        })}::jsonb
      )
      RETURNING id
    `);
    const disputeId = inserted[0]?.id;
    if (!disputeId) throw new BadRequestException('DISPUTE_CREATE_FAILED');

    this.logger.log(
      formatEscrowFrozenActiveLog({
        transactionId,
        disputeId,
      }),
    );

    return {
      STATUS: 'ESCROW_FROZEN_ACTIVE',
      ACTION: 'DISPUTE_RAISED',
      DISPUTE_ID: disputeId,
      TRANSACTION_ID: transactionId,
      DISPUTE_STATUS: 'OPEN',
      REASON: reason,
    };
  }

  /** Admin queue: OPEN + IN_REVIEW disputes. */
  async listOpenDisputes(limit = 50) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        transaction_id: string;
        initiator_id: string;
        reason: string;
        status: string;
        created_at: Date;
        amount_cents: number | string;
        net_amount_cents: number | string;
        transaction_type: string;
        tx_status: string;
        reference_id: string | null;
      }>
    >(Prisma.sql`
      SELECT
        d.id,
        d.transaction_id,
        d.initiator_id,
        d.reason,
        d.status::text AS status,
        d.created_at,
        t.amount_cents,
        t.net_amount_cents,
        t.transaction_type::text AS transaction_type,
        t.status::text AS tx_status,
        t.reference_id
      FROM public.disputes d
      JOIN public.financial_transactions t ON t.id = d.transaction_id
      WHERE d.status IN (
        'OPEN'::public.dispute_status,
        'IN_REVIEW'::public.dispute_status
      )
      ORDER BY d.created_at ASC
      LIMIT ${safeLimit}
    `);

    this.logger.log(`DISPUTE_ENGINE_INITIALIZED QUEUE=${rows.length}`);

    return {
      STATUS: 'DISPUTE_ENGINE_INITIALIZED',
      COUNT: rows.length,
      ITEMS: rows.map((row) => ({
        id: row.id,
        transactionId: row.transaction_id,
        initiatorId: row.initiator_id,
        reason: row.reason,
        status: row.status,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        amountCents: Number(row.amount_cents) || 0,
        netAmountCents: Number(row.net_amount_cents) || 0,
        transactionType: row.transaction_type,
        transactionStatus: row.tx_status,
        referenceId: row.reference_id,
      })),
    };
  }

  /**
   * Approve Refund → PaymentClearingService.refund + optional Stripe reverse.
   */
  async approveRefund(input: {
    disputeId: string;
    adminUserId: string;
    notes?: string;
  }) {
    const dispute = await this.loadDispute(input.disputeId);
    if (!isOpenDisputeStatus(dispute.status)) {
      throw new BadRequestException('DISPUTE_NOT_OPEN');
    }

    await this.markInReview(dispute.id);

    const refund = await this.clearing.refund(dispute.transaction_id);
    const stripeRefund = await this.tryStripeRefund(refund.METADATA, refund.NET_AMOUNT_CENTS);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.disputes
      SET
        status = 'RESOLVED_REFUNDED'::public.dispute_status,
        resolution_notes = ${input.notes?.trim() || 'APPROVE_REFUND'},
        resolved_by = ${input.adminUserId}::uuid,
        resolved_at = NOW(),
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
          stripeRefundId: stripeRefund?.id ?? null,
          stripeRefundStatus: stripeRefund?.status ?? null,
        })}::jsonb
      WHERE id = ${dispute.id}::uuid
    `);

    this.logger.log(
      `DISPUTE_ENGINE_INITIALIZED ACTION=RESOLVED_REFUNDED DISPUTE=${dispute.id}`,
    );

    this.notifications.dispatchSafe(
      this.notifications.notifyDisputeResolved({
        initiatorId: dispute.initiator_id,
        disputeId: dispute.id,
        resolution: 'RESOLVED_REFUNDED',
      }),
    );

    return {
      STATUS: 'DISPUTE_ENGINE_INITIALIZED',
      ACTION: 'RESOLVED_REFUNDED',
      DISPUTE_ID: dispute.id,
      TRANSACTION_ID: dispute.transaction_id,
      REFUND: refund,
      STRIPE_REFUND_ID: stripeRefund?.id ?? null,
    };
  }

  /**
   * Dismiss Dispute → unfreeze to HELD_IN_ESCROW (fulfillment may resume).
   */
  async dismissDispute(input: {
    disputeId: string;
    adminUserId: string;
    notes?: string;
    settle?: boolean;
  }) {
    const dispute = await this.loadDispute(input.disputeId);
    if (!isOpenDisputeStatus(dispute.status)) {
      throw new BadRequestException('DISPUTE_NOT_OPEN');
    }

    await this.markInReview(dispute.id);

    let release: unknown = null;
    if (input.settle) {
      const tx = await this.loadTransaction(dispute.transaction_id);
      await this.clearing.unfreezeEscrow(dispute.transaction_id);
      if (tx.reference_id && tx.transaction_type === 'WHOLESALE') {
        release = await this.clearing.releaseEscrow({
          procurementRequestId: tx.reference_id,
        });
      } else if (tx.reference_id) {
        release = await this.clearing.releaseEscrow(tx.reference_id);
      } else {
        release = await this.clearing.unfreezeEscrow(dispute.transaction_id);
      }
    } else {
      release = await this.clearing.unfreezeEscrow(dispute.transaction_id);
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.disputes
      SET
        status = 'RESOLVED_RELEASED'::public.dispute_status,
        resolution_notes = ${input.notes?.trim() || 'DISMISS_DISPUTE'},
        resolved_by = ${input.adminUserId}::uuid,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${dispute.id}::uuid
    `);

    this.logger.log(
      `DISPUTE_ENGINE_INITIALIZED ACTION=RESOLVED_RELEASED DISPUTE=${dispute.id}`,
    );

    this.notifications.dispatchSafe(
      this.notifications.notifyDisputeResolved({
        initiatorId: dispute.initiator_id,
        disputeId: dispute.id,
        resolution: 'RESOLVED_RELEASED',
      }),
    );

    return {
      STATUS: 'DISPUTE_ENGINE_INITIALIZED',
      ACTION: 'RESOLVED_RELEASED',
      DISPUTE_ID: dispute.id,
      TRANSACTION_ID: dispute.transaction_id,
      RELEASE: release,
    };
  }

  private async markInReview(disputeId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.disputes
      SET
        status = 'IN_REVIEW'::public.dispute_status,
        updated_at = NOW()
      WHERE id = ${disputeId}::uuid
        AND status = 'OPEN'::public.dispute_status
    `);
  }

  private async tryStripeRefund(
    metadata: unknown,
    amountCents: number,
  ): Promise<{ id: string; status: string } | null> {
    if (!this.stripe.isConfigured()) return null;
    const meta =
      metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : {};
    const paymentIntentId =
      typeof meta.stripe_payment_intent_id === 'string'
        ? meta.stripe_payment_intent_id
        : typeof meta.payment_intent_id === 'string'
          ? meta.payment_intent_id
          : null;
    if (!paymentIntentId) return null;
    try {
      return await this.stripe.refundPaymentIntent(paymentIntentId, amountCents);
    } catch (err) {
      this.logger.warn(
        `DISPUTE_ENGINE_INITIALIZED STRIPE_REFUND_SKIPPED ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private async loadTransaction(transactionId: string): Promise<{
    id: string;
    status: string;
    transaction_type: string;
    reference_id: string | null;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        transaction_type: string;
        reference_id: string | null;
      }>
    >(Prisma.sql`
      SELECT
        id,
        status::text AS status,
        transaction_type::text AS transaction_type,
        reference_id
      FROM public.financial_transactions
      WHERE id = ${transactionId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    return rows[0];
  }

  private async loadDispute(disputeId: string): Promise<{
    id: string;
    transaction_id: string;
    initiator_id: string;
    status: string;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        transaction_id: string;
        initiator_id: string;
        status: string;
      }>
    >(Prisma.sql`
      SELECT id, transaction_id, initiator_id, status::text AS status
      FROM public.disputes
      WHERE id = ${disputeId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('DISPUTE_NOT_FOUND');
    return rows[0];
  }

  private async findOpenDispute(
    transactionId: string,
  ): Promise<{ id: string; status: string } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; status: string }>
    >(Prisma.sql`
      SELECT id, status::text AS status
      FROM public.disputes
      WHERE transaction_id = ${transactionId}::uuid
        AND status IN (
          'OPEN'::public.dispute_status,
          'IN_REVIEW'::public.dispute_status
        )
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }
}
