/**
 * Payment clearing & escrow for catering deposits / platform capital.
 * Telemetry: FINANCIAL_ENGINE_INITIALIZED, ESCROW_LEDGER_ACTIVE
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
import { RedemptionService } from '../loyalty/redemption.service';
import {
  applyVoucherToAmount,
  formatEscrowLedgerActiveLog,
  formatFinancialEngineInitializedLog,
} from './financial.util';

@Injectable()
export class PaymentClearingService implements OnModuleInit {
  private readonly logger = new Logger(PaymentClearingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redemption: RedemptionService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatFinancialEngineInitializedLog());
    this.logger.log(formatEscrowLedgerActiveLog());
  }

  /**
   * Lock funds for a paid reference (catering inquiry OR B2B procurement).
   * Used by Stripe checkout.session.completed → internal escrow ledger sync.
   */
  async holdInEscrow(referenceId: string, amountCents: number) {
    if (!referenceId?.trim()) throw new BadRequestException('REFERENCE_ID_REQUIRED');
    const amount = Math.floor(Number(amountCents));
    if (!Number.isFinite(amount) || amount < 1) {
      throw new BadRequestException('AMOUNT_INVALID');
    }

    const inquiry = await this.findInquiry(referenceId);
    if (inquiry) {
      return this.holdCateringEscrow(referenceId, amount);
    }

    const procurement = await this.findProcurement(referenceId);
    if (procurement) {
      if (procurement.status !== 'ACCEPTED' && procurement.status !== 'PENDING') {
        throw new BadRequestException('PROCUREMENT_NOT_HOLDABLE');
      }
      if (procurement.status === 'PENDING') {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE public.b2b_procurement_requests
          SET status = 'ACCEPTED', updated_at = NOW()
          WHERE id = ${referenceId}::uuid
            AND status = 'PENDING'
        `);
      }
      return this.holdWholesaleEscrow(referenceId, amount);
    }

    throw new NotFoundException('REFERENCE_NOT_FOUND');
  }

  /**
   * Lock deposit funds when a catering inquiry is paid / accepted.
   * Applies active shopper loyalty vouchers via RedemptionService ($5 off).
   */
  async holdCateringEscrow(inquiryId: string, amountCents: number) {
    if (!inquiryId?.trim()) throw new BadRequestException('INQUIRY_ID_REQUIRED');
    const amount = Math.floor(Number(amountCents));
    if (!Number.isFinite(amount) || amount < 1) {
      throw new BadRequestException('AMOUNT_INVALID');
    }

    const inquiry = await this.loadInquiry(inquiryId);
    if (inquiry.escrow_transaction_id) {
      return {
        STATUS: 'ESCROW_LEDGER_ACTIVE',
        ACTION: 'HELD_IN_ESCROW',
        TRANSACTION_ID: inquiry.escrow_transaction_id,
        INQUIRY_ID: inquiryId,
        AMOUNT_CENTS: amount,
        VOUCHER_CENTS: 0,
        NET_AMOUNT_CENTS: amount,
        ALREADY_HELD: true,
      };
    }

    const voucher = await this.redemption.resolveActiveVoucherCents({
      shopperId: inquiry.shopper_id,
      vendorId: inquiry.vendor_id,
    });

    const layout = applyVoucherToAmount({
      amountCents: amount,
      voucherCents: voucher.voucherCents,
    });

    await this.ensureVendorBalance(inquiry.vendor_id);

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.financial_transactions (
        source_id, destination_id, amount_cents, voucher_cents, net_amount_cents,
        status, transaction_type, reference_id, metadata
      ) VALUES (
        ${inquiry.shopper_id}::uuid,
        ${inquiry.vendor_id}::uuid,
        ${layout.amountCents},
        ${layout.voucherCents},
        ${layout.netAmountCents},
        'HELD_IN_ESCROW'::public.financial_transaction_status,
        'CATERING_DEPOSIT'::public.financial_transaction_type,
        ${inquiryId}::uuid,
        ${JSON.stringify({
          inquiryId,
          redemptionId: voucher.redemptionId,
          layout: 'FINAL_TRANSACTION',
        })}::jsonb
      )
      RETURNING id
    `);

    const txId = rows[0]?.id;
    if (!txId) throw new BadRequestException('ESCROW_CREATE_FAILED');

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.vendor_balances
      SET
        escrow_held_cents = escrow_held_cents + ${layout.netAmountCents},
        loyalty_liability_cents = loyalty_liability_cents + ${layout.voucherCents},
        updated_at = NOW()
      WHERE vendor_id = ${inquiry.vendor_id}::uuid
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.catering_inquiries
      SET
        status = 'ACCEPTED',
        deposit_cents = ${layout.amountCents},
        voucher_cents_applied = ${layout.voucherCents},
        escrow_transaction_id = ${txId}::uuid,
        updated_at = NOW()
      WHERE id = ${inquiryId}::uuid
    `);

    if (voucher.redemptionId && layout.voucherCents > 0) {
      await this.redemption.markVoucherUsed(voucher.redemptionId);
    }

    this.logger.log(
      formatEscrowLedgerActiveLog({
        transactionId: txId,
        status: 'HELD_IN_ESCROW',
        netCents: layout.netAmountCents,
      }),
    );

    return {
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      ACTION: 'HELD_IN_ESCROW',
      TRANSACTION_ID: txId,
      INQUIRY_ID: inquiryId,
      AMOUNT_CENTS: layout.amountCents,
      VOUCHER_CENTS: layout.voucherCents,
      NET_AMOUNT_CENTS: layout.netAmountCents,
      ALREADY_HELD: false,
    };
  }

  /**
   * Disburse escrow after fulfillment.
   * Catering: pass inquiry id string (legacy) or `{ inquiryId }`.
   * B2B wholesale: pass `{ procurementRequestId }` (farmer available balance).
   */
  async releaseEscrow(
    input:
      | string
      | {
          inquiryId?: string;
          procurementRequestId?: string;
        },
  ) {
    if (typeof input === 'string') {
      return this.releaseCateringEscrow(input);
    }
    if (input.procurementRequestId?.trim()) {
      return this.releaseWholesaleEscrow(input.procurementRequestId);
    }
    if (input.inquiryId?.trim()) {
      return this.releaseCateringEscrow(input.inquiryId);
    }
    throw new BadRequestException('RELEASE_REF_REQUIRED');
  }

  /**
   * Lock wholesale funds when an ACCEPTED procurement is staged on a delivery route.
   * Destination is the farmer wallet (farmer_balances).
   */
  async holdWholesaleEscrow(procurementRequestId: string, amountCents: number) {
    if (!procurementRequestId?.trim()) {
      throw new BadRequestException('PROCUREMENT_REQUEST_ID_REQUIRED');
    }
    const amount = Math.floor(Number(amountCents));
    if (!Number.isFinite(amount) || amount < 1) {
      throw new BadRequestException('AMOUNT_INVALID');
    }

    const request = await this.loadProcurement(procurementRequestId);
    if (request.status !== 'ACCEPTED') {
      throw new BadRequestException('PROCUREMENT_NOT_ACCEPTED');
    }
    if (request.escrow_transaction_id) {
      return {
        STATUS: 'ESCROW_LEDGER_ACTIVE',
        ACTION: 'HELD_IN_ESCROW',
        TRANSACTION_ID: request.escrow_transaction_id,
        PROCUREMENT_REQUEST_ID: procurementRequestId,
        AMOUNT_CENTS: Number(request.deposit_cents) || amount,
        NET_AMOUNT_CENTS: Number(request.deposit_cents) || amount,
        ALREADY_HELD: true,
      };
    }

    await this.ensureFarmerBalance(request.farmer_id);

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.financial_transactions (
        source_id, destination_id, amount_cents, voucher_cents, net_amount_cents,
        status, transaction_type, reference_id, metadata
      ) VALUES (
        ${request.vendor_id}::uuid,
        ${request.farmer_id}::uuid,
        ${amount},
        0,
        ${amount},
        'HELD_IN_ESCROW'::public.financial_transaction_status,
        'WHOLESALE'::public.financial_transaction_type,
        ${procurementRequestId}::uuid,
        ${JSON.stringify({
          procurementRequestId,
          layout: 'B2B_WHOLESALE',
        })}::jsonb
      )
      RETURNING id
    `);

    const txId = rows[0]?.id;
    if (!txId) throw new BadRequestException('ESCROW_CREATE_FAILED');

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.farmer_balances
      SET
        escrow_held_cents = escrow_held_cents + ${amount},
        updated_at = NOW()
      WHERE farmer_id = ${request.farmer_id}::uuid
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.b2b_procurement_requests
      SET
        deposit_cents = ${amount},
        escrow_transaction_id = ${txId}::uuid,
        updated_at = NOW()
      WHERE id = ${procurementRequestId}::uuid
    `);

    this.logger.log(
      formatEscrowLedgerActiveLog({
        transactionId: txId,
        status: 'HELD_IN_ESCROW',
        netCents: amount,
      }),
    );

    return {
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      ACTION: 'HELD_IN_ESCROW',
      TRANSACTION_ID: txId,
      PROCUREMENT_REQUEST_ID: procurementRequestId,
      AMOUNT_CENTS: amount,
      NET_AMOUNT_CENTS: amount,
      ALREADY_HELD: false,
    };
  }

  /** Disburse catering escrow to vendor available balance after event fulfillment. */
  private async releaseCateringEscrow(inquiryId: string) {
    if (!inquiryId?.trim()) throw new BadRequestException('INQUIRY_ID_REQUIRED');

    const inquiry = await this.loadInquiry(inquiryId);
    if (!inquiry.escrow_transaction_id) {
      throw new BadRequestException('ESCROW_NOT_FOUND');
    }

    const tx = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        net_amount_cents: number | string;
        destination_id: string | null;
      }>
    >(Prisma.sql`
      SELECT id, status::text AS status, net_amount_cents, destination_id
      FROM public.financial_transactions
      WHERE id = ${inquiry.escrow_transaction_id}::uuid
      LIMIT 1
    `);
    if (!tx[0]) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    if (tx[0].status === 'FROZEN') {
      throw new BadRequestException('ESCROW_FROZEN');
    }
    if (tx[0].status !== 'HELD_IN_ESCROW') {
      throw new BadRequestException('ESCROW_NOT_HELD');
    }

    const net = Number(tx[0].net_amount_cents) || 0;
    const vendorId = tx[0].destination_id ?? inquiry.vendor_id;

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.financial_transactions
      SET
        status = 'SETTLED'::public.financial_transaction_status,
        updated_at = NOW()
      WHERE id = ${tx[0].id}::uuid
    `);

    await this.ensureVendorBalance(vendorId);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.vendor_balances
      SET
        escrow_held_cents = GREATEST(0, escrow_held_cents - ${net}),
        available_cents = available_cents + ${net},
        updated_at = NOW()
      WHERE vendor_id = ${vendorId}::uuid
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.catering_inquiries
      SET status = 'FULFILLED', updated_at = NOW()
      WHERE id = ${inquiryId}::uuid
    `);

    this.logger.log(
      formatEscrowLedgerActiveLog({
        transactionId: tx[0].id,
        status: 'SETTLED',
        netCents: net,
      }),
    );

    return {
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      ACTION: 'SETTLED',
      TRANSACTION_ID: tx[0].id,
      INQUIRY_ID: inquiryId,
      NET_AMOUNT_CENTS: net,
    };
  }

  /** Disburse wholesale escrow into farmer available balance after dropoff. */
  private async releaseWholesaleEscrow(procurementRequestId: string) {
    if (!procurementRequestId?.trim()) {
      throw new BadRequestException('PROCUREMENT_REQUEST_ID_REQUIRED');
    }

    const request = await this.loadProcurement(procurementRequestId);
    if (!request.escrow_transaction_id) {
      throw new BadRequestException('ESCROW_NOT_FOUND');
    }

    const tx = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        net_amount_cents: number | string;
        destination_id: string | null;
      }>
    >(Prisma.sql`
      SELECT id, status::text AS status, net_amount_cents, destination_id
      FROM public.financial_transactions
      WHERE id = ${request.escrow_transaction_id}::uuid
      LIMIT 1
    `);
    if (!tx[0]) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    if (tx[0].status === 'FROZEN') {
      throw new BadRequestException('ESCROW_FROZEN');
    }
    if (tx[0].status !== 'HELD_IN_ESCROW') {
      throw new BadRequestException('ESCROW_NOT_HELD');
    }

    const net = Number(tx[0].net_amount_cents) || 0;
    const farmerId = tx[0].destination_id ?? request.farmer_id;

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.financial_transactions
      SET
        status = 'SETTLED'::public.financial_transaction_status,
        updated_at = NOW()
      WHERE id = ${tx[0].id}::uuid
    `);

    await this.ensureFarmerBalance(farmerId);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.farmer_balances
      SET
        escrow_held_cents = GREATEST(0, escrow_held_cents - ${net}),
        available_cents = available_cents + ${net},
        updated_at = NOW()
      WHERE farmer_id = ${farmerId}::uuid
    `);

    this.logger.log(
      formatEscrowLedgerActiveLog({
        transactionId: tx[0].id,
        status: 'SETTLED',
        netCents: net,
      }),
    );

    return {
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      ACTION: 'SETTLED',
      TRANSACTION_ID: tx[0].id,
      PROCUREMENT_REQUEST_ID: procurementRequestId,
      FARMER_ID: farmerId,
      NET_AMOUNT_CENTS: net,
    };
  }

  async getVendorBalance(vendorId: string) {
    await this.ensureVendorBalance(vendorId);
    const rows = await this.prisma.$queryRaw<
      Array<{
        available_cents: number | string;
        escrow_held_cents: number | string;
        loyalty_liability_cents: number | string;
        micro_fee_cents: number | string;
      }>
    >(Prisma.sql`
      SELECT available_cents, escrow_held_cents, loyalty_liability_cents, micro_fee_cents
      FROM public.vendor_balances
      WHERE vendor_id = ${vendorId}::uuid
      LIMIT 1
    `);
    const row = rows[0];
    return {
      STATUS: 'FINANCIAL_UI_ACTIVE',
      VENDOR_ID: vendorId,
      AVAILABLE_CENTS: Number(row?.available_cents) || 0,
      ESCROW_HELD_CENTS: Number(row?.escrow_held_cents) || 0,
      LOYALTY_LIABILITY_CENTS: Number(row?.loyalty_liability_cents) || 0,
      MICRO_FEE_CENTS: Number(row?.micro_fee_cents) || 0,
    };
  }

  /**
   * Reverse a FROZEN escrow hold to REFUNDED and release held wallet balance.
   * Stripe charge reversal is orchestrated by DisputeService when a PI is known.
   */
  async refund(transactionId: string) {
    if (!transactionId?.trim()) {
      throw new BadRequestException('TRANSACTION_ID_REQUIRED');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        net_amount_cents: number | string;
        destination_id: string | null;
        transaction_type: string;
        metadata: unknown;
      }>
    >(Prisma.sql`
      SELECT
        id,
        status::text AS status,
        net_amount_cents,
        destination_id,
        transaction_type::text AS transaction_type,
        metadata
      FROM public.financial_transactions
      WHERE id = ${transactionId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    const tx = rows[0];
    if (tx.status === 'REFUNDED') {
      return {
        STATUS: 'ESCROW_LEDGER_ACTIVE',
        ACTION: 'REFUNDED',
        TRANSACTION_ID: tx.id,
        NET_AMOUNT_CENTS: Number(tx.net_amount_cents) || 0,
        ALREADY_REFUNDED: true,
        METADATA: tx.metadata,
      };
    }
    if (tx.status !== 'FROZEN' && tx.status !== 'HELD_IN_ESCROW') {
      throw new BadRequestException('ESCROW_NOT_REFUNDABLE');
    }

    const net = Number(tx.net_amount_cents) || 0;
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.financial_transactions
      SET
        status = 'REFUNDED'::public.financial_transaction_status,
        updated_at = NOW()
      WHERE id = ${tx.id}::uuid
    `);

    if (tx.destination_id && tx.transaction_type === 'WHOLESALE') {
      await this.ensureFarmerBalance(tx.destination_id);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.farmer_balances
        SET
          escrow_held_cents = GREATEST(0, escrow_held_cents - ${net}),
          updated_at = NOW()
        WHERE farmer_id = ${tx.destination_id}::uuid
      `);
    } else if (tx.destination_id) {
      await this.ensureVendorBalance(tx.destination_id);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.vendor_balances
        SET
          escrow_held_cents = GREATEST(0, escrow_held_cents - ${net}),
          updated_at = NOW()
        WHERE vendor_id = ${tx.destination_id}::uuid
      `);
    }

    this.logger.log(
      formatEscrowLedgerActiveLog({
        transactionId: tx.id,
        status: 'REFUNDED',
        netCents: net,
      }),
    );

    return {
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      ACTION: 'REFUNDED',
      TRANSACTION_ID: tx.id,
      NET_AMOUNT_CENTS: net,
      TRANSACTION_TYPE: tx.transaction_type,
      DESTINATION_ID: tx.destination_id,
      METADATA: tx.metadata,
      ALREADY_REFUNDED: false,
    };
  }

  /** Unfreeze a FROZEN escrow row back to HELD_IN_ESCROW (dismiss dispute). */
  async unfreezeEscrow(transactionId: string) {
    if (!transactionId?.trim()) {
      throw new BadRequestException('TRANSACTION_ID_REQUIRED');
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; status: string; net_amount_cents: number | string }>
    >(Prisma.sql`
      SELECT id, status::text AS status, net_amount_cents
      FROM public.financial_transactions
      WHERE id = ${transactionId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    if (rows[0].status === 'HELD_IN_ESCROW') {
      return {
        STATUS: 'ESCROW_LEDGER_ACTIVE',
        ACTION: 'HELD_IN_ESCROW',
        TRANSACTION_ID: rows[0].id,
        ALREADY_HELD: true,
      };
    }
    if (rows[0].status !== 'FROZEN') {
      throw new BadRequestException('ESCROW_NOT_FROZEN');
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.financial_transactions
      SET
        status = 'HELD_IN_ESCROW'::public.financial_transaction_status,
        updated_at = NOW()
      WHERE id = ${rows[0].id}::uuid
    `);

    this.logger.log(
      formatEscrowLedgerActiveLog({
        transactionId: rows[0].id,
        status: 'HELD_IN_ESCROW',
        netCents: Number(rows[0].net_amount_cents) || 0,
      }),
    );

    return {
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      ACTION: 'HELD_IN_ESCROW',
      TRANSACTION_ID: rows[0].id,
      ALREADY_HELD: false,
    };
  }

  async listTransactionsForVendor(vendorId: string, limit = 40) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          amount_cents: number | string;
          voucher_cents: number | string;
          net_amount_cents: number | string;
          status: string;
          transaction_type: string;
          reference_id: string | null;
          created_at: Date;
        }>
      >(Prisma.sql`
        SELECT
          id,
          amount_cents,
          voucher_cents,
          net_amount_cents,
          status::text AS status,
          transaction_type::text AS transaction_type,
          reference_id,
          created_at
        FROM public.financial_transactions
        WHERE destination_id = ${vendorId}::uuid
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `);

      this.logger.log(`FINANCIAL_UI_ACTIVE TX_COUNT=${rows.length}`);
      return {
        STATUS: 'FINANCIAL_UI_ACTIVE',
        ITEMS: rows.map((row) => ({
          id: row.id,
          amountCents: Number(row.amount_cents) || 0,
          voucherCents: Number(row.voucher_cents) || 0,
          netAmountCents: Number(row.net_amount_cents) || 0,
          status: row.status,
          transactionType: row.transaction_type,
          referenceId: row.reference_id,
          createdAt: row.created_at,
        })),
        COUNT: rows.length,
      };
    } catch {
      return { STATUS: 'FINANCIAL_UI_ACTIVE', ITEMS: [], COUNT: 0 };
    }
  }

  private async findInquiry(inquiryId: string): Promise<{
    id: string;
    vendor_id: string;
    shopper_id: string;
    status: string;
    escrow_transaction_id: string | null;
  } | null> {
    try {
      return await this.loadInquiry(inquiryId);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  private async findProcurement(procurementRequestId: string): Promise<{
    id: string;
    vendor_id: string;
    farmer_id: string;
    status: string;
    deposit_cents: number | string | null;
    escrow_transaction_id: string | null;
  } | null> {
    try {
      return await this.loadProcurement(procurementRequestId);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  private async loadInquiry(inquiryId: string): Promise<{
    id: string;
    vendor_id: string;
    shopper_id: string;
    status: string;
    escrow_transaction_id: string | null;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        shopper_id: string;
        status: string;
        escrow_transaction_id: string | null;
      }>
    >(Prisma.sql`
      SELECT id, vendor_id, shopper_id, status, escrow_transaction_id
      FROM public.catering_inquiries
      WHERE id = ${inquiryId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('INQUIRY_NOT_FOUND');
    return rows[0];
  }

  private async loadProcurement(procurementRequestId: string): Promise<{
    id: string;
    vendor_id: string;
    farmer_id: string;
    status: string;
    deposit_cents: number | string | null;
    escrow_transaction_id: string | null;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        farmer_id: string;
        status: string;
        deposit_cents: number | string | null;
        escrow_transaction_id: string | null;
      }>
    >(Prisma.sql`
      SELECT
        id, vendor_id, farmer_id, status,
        deposit_cents, escrow_transaction_id
      FROM public.b2b_procurement_requests
      WHERE id = ${procurementRequestId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('PROCUREMENT_REQUEST_NOT_FOUND');
    return rows[0];
  }

  private async ensureVendorBalance(vendorId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.vendor_balances (vendor_id)
      VALUES (${vendorId}::uuid)
      ON CONFLICT (vendor_id) DO NOTHING
    `);
  }

  private async ensureFarmerBalance(farmerId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.farmer_balances (farmer_id)
      VALUES (${farmerId}::uuid)
      ON CONFLICT (farmer_id) DO NOTHING
    `);
  }
}
