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
   * Lock deposit funds when a catering inquiry is ACCEPTED.
   * Applies active shopper loyalty vouchers via RedemptionService ($5 off).
   */
  async holdInEscrow(inquiryId: string, amountCents: number) {
    if (!inquiryId?.trim()) throw new BadRequestException('INQUIRY_ID_REQUIRED');
    const amount = Math.floor(Number(amountCents));
    if (!Number.isFinite(amount) || amount < 1) {
      throw new BadRequestException('AMOUNT_INVALID');
    }

    const inquiry = await this.loadInquiry(inquiryId);
    if (inquiry.escrow_transaction_id) {
      throw new BadRequestException('ESCROW_ALREADY_HELD');
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
    };
  }

  /**
   * Disburse escrow to vendor available balance after event fulfillment.
   */
  async releaseEscrow(inquiryId: string) {
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

  private async ensureVendorBalance(vendorId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.vendor_balances (vendor_id)
      VALUES (${vendorId}::uuid)
      ON CONFLICT (vendor_id) DO NOTHING
    `);
  }
}
