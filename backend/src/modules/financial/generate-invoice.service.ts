/**
 * GenerateInvoiceService — dynamic invoices for catering / B2B procurement.
 * Telemetry: INVOICING_ENGINE_INITIALIZED, FINANCIAL_UI_ACTIVE
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  computePlatformFeeCents,
  DEFAULT_PLATFORM_FEE_BPS,
} from '../../common/settlement/platform-fee';
import { PrismaService } from '../../prisma/prisma.service';
import { REDEMPTION_RULES } from '../loyalty/loyalty.util';
import {
  formatCents,
  formatFinancialUiActiveLog,
  formatInvoicingEngineInitializedLog,
} from './financial.util';

export type InvoiceLineItem = {
  label: string;
  quantity: number | null;
  unitCents: number | null;
  totalCents: number;
  kind: 'CHARGE' | 'LOYALTY_VOUCHER' | 'PLATFORM_FEE' | 'NOTE';
};

export type GeneratedInvoice = {
  STATUS: string;
  INVOICE_ID: string;
  SOURCE: 'CATERING_INQUIRY' | 'B2B_PROCUREMENT';
  SOURCE_ID: string;
  VENDOR_ID: string;
  VENDOR_NAME: string | null;
  COUNTERPARTY_NAME: string | null;
  ISSUED_AT: string;
  STATUS_LABEL: string;
  CURRENCY: 'USD';
  LINES: InvoiceLineItem[];
  SUBTOTAL_CENTS: number;
  LOYALTY_VOUCHER_CENTS: number;
  LOYALTY_POINTS_APPLIED: number;
  PLATFORM_FEE_CENTS: number;
  PLATFORM_FEE_BPS: number;
  TOTAL_CENTS: number;
  VENDOR_NET_CENTS: number;
  HTML: string;
};

@Injectable()
export class GenerateInvoiceService implements OnModuleInit {
  private readonly logger = new Logger(GenerateInvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatInvoicingEngineInitializedLog());
    this.logger.log(formatFinancialUiActiveLog());
  }

  async fromCateringInquiry(inquiryId: string): Promise<GeneratedInvoice> {
    if (!inquiryId?.trim()) throw new BadRequestException('INQUIRY_ID_REQUIRED');

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        shopper_id: string;
        message: string;
        guest_count: number | null;
        event_date: Date | string | null;
        status: string;
        deposit_cents: number | string | null;
        voucher_cents_applied: number | string | null;
        business_name: string | null;
      }>
    >(Prisma.sql`
      SELECT
        i.id, i.vendor_id, i.shopper_id, i.message, i.guest_count,
        i.event_date, i.status, i.deposit_cents, i.voucher_cents_applied,
        v.business_name
      FROM public.catering_inquiries i
      JOIN public.vendors v ON v.id = i.vendor_id
      WHERE i.id = ${inquiryId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('INQUIRY_NOT_FOUND');
    const row = rows[0];
    if (row.status !== 'ACCEPTED' && row.status !== 'FULFILLED') {
      throw new BadRequestException('INVOICE_REQUIRES_ACCEPTED_OR_FULFILLED');
    }

    const deposit = Number(row.deposit_cents) || 0;
    const voucher = Number(row.voucher_cents_applied) || 0;
    const loyaltyPoints =
      voucher > 0 ? REDEMPTION_RULES.VOUCHER_5.points : 0;
    const due = Math.max(0, deposit - voucher);
    const platformFee = computePlatformFeeCents(due, DEFAULT_PLATFORM_FEE_BPS);
    const vendorNet = Math.max(0, due - platformFee);

    const lines: InvoiceLineItem[] = [
      {
        label: 'Catering deposit',
        quantity: row.guest_count,
        unitCents: null,
        totalCents: deposit,
        kind: 'CHARGE',
      },
    ];
    if (voucher > 0) {
      lines.push({
        label: `Loyalty points applied via RedemptionService (${loyaltyPoints} pts, VOUCHER_5)`,
        quantity: 1,
        unitCents: -voucher,
        totalCents: -voucher,
        kind: 'LOYALTY_VOUCHER',
      });
    }
    lines.push({
      label: `Platform fee (${DEFAULT_PLATFORM_FEE_BPS / 100}%)`,
      quantity: 1,
      unitCents: platformFee,
      totalCents: platformFee,
      kind: 'PLATFORM_FEE',
    });
    lines.push({
      label: `Inquiry note: ${row.message.slice(0, 120)}`,
      quantity: null,
      unitCents: null,
      totalCents: 0,
      kind: 'NOTE',
    });

    const invoice = this.buildInvoice({
      source: 'CATERING_INQUIRY',
      sourceId: row.id,
      vendorId: row.vendor_id,
      vendorName: row.business_name,
      counterpartyName: 'Shopper',
      statusLabel: row.status,
      lines,
      subtotalCents: deposit,
      loyaltyVoucherCents: voucher,
      loyaltyPointsApplied: loyaltyPoints,
      platformFeeCents: platformFee,
      totalCents: due,
      vendorNetCents: vendorNet,
      eventDate:
        row.event_date != null ? String(row.event_date).slice(0, 10) : null,
    });

    this.logger.log(
      `INVOICING_ENGINE_INITIALIZED ACTION=CATERING INVOICE=${invoice.INVOICE_ID}`,
    );
    return invoice;
  }

  async fromProcurementRequest(requestId: string): Promise<GeneratedInvoice> {
    if (!requestId?.trim()) throw new BadRequestException('REQUEST_ID_REQUIRED');

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        farmer_id: string;
        listing_id: string | null;
        message: string | null;
        requested_quantity: number | string | null;
        status: string;
        business_name: string | null;
        farm_name: string | null;
        item_name: string | null;
        bulk_unit_price: number | string | null;
      }>
    >(Prisma.sql`
      SELECT
        r.id, r.vendor_id, r.farmer_id, r.listing_id, r.message,
        r.requested_quantity, r.status,
        v.business_name, f.farm_name, l.item_name, l.bulk_unit_price
      FROM public.b2b_procurement_requests r
      JOIN public.vendors v ON v.id = r.vendor_id
      JOIN public.farmers f ON f.id = r.farmer_id
      LEFT JOIN public.wholesale_listings l ON l.id = r.listing_id
      WHERE r.id = ${requestId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('PROCUREMENT_REQUEST_NOT_FOUND');
    const row = rows[0];
    if (row.status !== 'ACCEPTED') {
      throw new BadRequestException('INVOICE_REQUIRES_ACCEPTED_PROCUREMENT');
    }

    const qty = row.requested_quantity != null ? Number(row.requested_quantity) : 1;
    const unit = row.bulk_unit_price != null ? Math.round(Number(row.bulk_unit_price) * 100) : 0;
    const subtotal = Math.max(0, qty * unit);
    const platformFee = computePlatformFeeCents(subtotal, DEFAULT_PLATFORM_FEE_BPS);
    const vendorNet = Math.max(0, subtotal - platformFee);

    const lines: InvoiceLineItem[] = [
      {
        label: row.item_name?.trim() || 'Wholesale procurement',
        quantity: qty,
        unitCents: unit,
        totalCents: subtotal,
        kind: 'CHARGE',
      },
      {
        label: `Platform fee (${DEFAULT_PLATFORM_FEE_BPS / 100}%)`,
        quantity: 1,
        unitCents: platformFee,
        totalCents: platformFee,
        kind: 'PLATFORM_FEE',
      },
    ];
    if (row.message?.trim()) {
      lines.push({
        label: `Note: ${row.message.trim().slice(0, 120)}`,
        quantity: null,
        unitCents: null,
        totalCents: 0,
        kind: 'NOTE',
      });
    }

    const invoice = this.buildInvoice({
      source: 'B2B_PROCUREMENT',
      sourceId: row.id,
      vendorId: row.vendor_id,
      vendorName: row.business_name,
      counterpartyName: row.farm_name ?? 'Farm supplier',
      statusLabel: row.status,
      lines,
      subtotalCents: subtotal,
      loyaltyVoucherCents: 0,
      loyaltyPointsApplied: 0,
      platformFeeCents: platformFee,
      totalCents: subtotal,
      vendorNetCents: vendorNet,
      eventDate: null,
    });

    this.logger.log(
      `INVOICING_ENGINE_INITIALIZED ACTION=PROCUREMENT INVOICE=${invoice.INVOICE_ID}`,
    );
    return invoice;
  }

  private buildInvoice(input: {
    source: 'CATERING_INQUIRY' | 'B2B_PROCUREMENT';
    sourceId: string;
    vendorId: string;
    vendorName: string | null;
    counterpartyName: string | null;
    statusLabel: string;
    lines: InvoiceLineItem[];
    subtotalCents: number;
    loyaltyVoucherCents: number;
    loyaltyPointsApplied: number;
    platformFeeCents: number;
    totalCents: number;
    vendorNetCents: number;
    eventDate: string | null;
  }): GeneratedInvoice {
    const issuedAt = new Date().toISOString();
    const invoiceId = `INV-${input.source.slice(0, 3)}-${input.sourceId.slice(0, 8).toUpperCase()}`;
    const html = this.renderHtml({
      invoiceId,
      ...input,
      issuedAt,
    });

    return {
      STATUS: 'INVOICING_ENGINE_INITIALIZED',
      INVOICE_ID: invoiceId,
      SOURCE: input.source,
      SOURCE_ID: input.sourceId,
      VENDOR_ID: input.vendorId,
      VENDOR_NAME: input.vendorName,
      COUNTERPARTY_NAME: input.counterpartyName,
      ISSUED_AT: issuedAt,
      STATUS_LABEL: input.statusLabel,
      CURRENCY: 'USD',
      LINES: input.lines,
      SUBTOTAL_CENTS: input.subtotalCents,
      LOYALTY_VOUCHER_CENTS: input.loyaltyVoucherCents,
      LOYALTY_POINTS_APPLIED: input.loyaltyPointsApplied,
      PLATFORM_FEE_CENTS: input.platformFeeCents,
      PLATFORM_FEE_BPS: DEFAULT_PLATFORM_FEE_BPS,
      TOTAL_CENTS: input.totalCents,
      VENDOR_NET_CENTS: input.vendorNetCents,
      HTML: html,
    };
  }

  private renderHtml(input: {
    invoiceId: string;
    source: string;
    sourceId: string;
    vendorName: string | null;
    counterpartyName: string | null;
    statusLabel: string;
    lines: InvoiceLineItem[];
    subtotalCents: number;
    loyaltyVoucherCents: number;
    loyaltyPointsApplied: number;
    platformFeeCents: number;
    totalCents: number;
    vendorNetCents: number;
    issuedAt: string;
    eventDate: string | null;
  }): string {
    const rows = input.lines
      .map((line) => {
        const qty = line.quantity != null ? String(line.quantity) : '—';
        const unit =
          line.unitCents != null ? formatCents(Math.abs(line.unitCents)) : '—';
        const total =
          line.kind === 'NOTE' ? '—' : formatCents(line.totalCents);
        return `<tr>
          <td>${escapeHtml(line.label)}</td>
          <td>${qty}</td>
          <td>${unit}</td>
          <td>${total}</td>
        </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.invoiceId)}</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; margin: 2rem; }
    h1 { font-size: 1.25rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .meta { color: #444; font-size: 0.85rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border-bottom: 1px solid #ddd; padding: 0.5rem; text-align: left; font-size: 0.85rem; }
    th { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.7rem; color: #666; }
    .totals { margin-top: 1.5rem; text-align: right; }
    .totals div { margin: 0.25rem 0; }
    .total { font-weight: 700; font-size: 1.1rem; }
  </style>
</head>
<body>
  <h1>INVOICE ${escapeHtml(input.invoiceId)}</h1>
  <div class="meta">
    <div>VENDOR: ${escapeHtml(input.vendorName ?? '—')}</div>
    <div>PARTY: ${escapeHtml(input.counterpartyName ?? '—')}</div>
    <div>SOURCE: ${escapeHtml(input.source)} / ${escapeHtml(input.sourceId)}</div>
    <div>STATUS: ${escapeHtml(input.statusLabel)}</div>
    <div>ISSUED: ${escapeHtml(input.issuedAt)}</div>
    ${input.eventDate ? `<div>EVENT DATE: ${escapeHtml(input.eventDate)}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div>SUBTOTAL ${formatCents(input.subtotalCents)}</div>
    <div>LOYALTY POINTS APPLIED (REDEMPTIONSERVICE) ${input.loyaltyPointsApplied}</div>
    <div>LOYALTY VOUCHER −${formatCents(input.loyaltyVoucherCents)}</div>
    <div>PLATFORM FEE −${formatCents(input.platformFeeCents)}</div>
    <div class="total">AMOUNT DUE ${formatCents(input.totalCents)}</div>
    <div>VENDOR NET ${formatCents(input.vendorNetCents)}</div>
  </div>
  <p style="margin-top:2rem;font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;">
    INVOICING_ENGINE_INITIALIZED · FINANCIAL_UI_ACTIVE
  </p>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
