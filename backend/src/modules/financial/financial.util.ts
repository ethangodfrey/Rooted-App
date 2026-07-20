/**
 * Financial clearing & escrow helpers.
 * Telemetry: FINANCIAL_ENGINE_INITIALIZED, ESCROW_LEDGER_ACTIVE
 */

export type FinancialTransactionStatus =
  | 'PENDING'
  | 'HELD_IN_ESCROW'
  | 'SETTLED'
  | 'REFUNDED';

export type FinancialTransactionType =
  | 'WHOLESALE'
  | 'CATERING_DEPOSIT'
  | 'LOYALTY_BOOST';

export function formatFinancialEngineInitializedLog(): string {
  return 'FINANCIAL_ENGINE_INITIALIZED SERVICE=PaymentClearingService';
}

export function formatEscrowLedgerActiveLog(input?: {
  transactionId?: string;
  status?: FinancialTransactionStatus;
  netCents?: number;
}): string {
  const parts = ['ESCROW_LEDGER_ACTIVE'];
  if (input?.transactionId) parts.push(`TX=${input.transactionId}`);
  if (input?.status) parts.push(`STATUS=${input.status}`);
  if (input?.netCents != null) parts.push(`NET_CENTS=${input.netCents}`);
  return parts.join(' ');
}

/** Phase 4 Vendor Financial Dashboard telemetry (no emoji). */
export function formatFinancialUiActiveLog(input?: {
  availableCents?: number;
}): string {
  if (input?.availableCents != null) {
    return `FINANCIAL_UI_ACTIVE AVAILABLE_CENTS=${input.availableCents}`;
  }
  return 'FINANCIAL_UI_ACTIVE';
}

export function formatInvoicingEngineInitializedLog(): string {
  return 'INVOICING_ENGINE_INITIALIZED SERVICE=GenerateInvoiceService';
}

/** @deprecated Prefer formatInvoicingEngineInitializedLog */
export function formatInvoicingDashboardInitializedLog(): string {
  return formatInvoicingEngineInitializedLog();
}

export function normalizeFinancialStatus(
  value: string | null | undefined,
): FinancialTransactionStatus | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (
    upper === 'PENDING' ||
    upper === 'HELD_IN_ESCROW' ||
    upper === 'SETTLED' ||
    upper === 'REFUNDED'
  ) {
    return upper;
  }
  return null;
}

export function normalizeFinancialType(
  value: string | null | undefined,
): FinancialTransactionType | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (
    upper === 'WHOLESALE' ||
    upper === 'CATERING_DEPOSIT' ||
    upper === 'LOYALTY_BOOST'
  ) {
    return upper;
  }
  return null;
}

/**
 * Apply loyalty voucher cents to a gross amount.
 * Never returns a negative net.
 */
export function applyVoucherToAmount(input: {
  amountCents: number;
  voucherCents: number;
}): { amountCents: number; voucherCents: number; netAmountCents: number } {
  const amount = Math.max(0, Math.floor(input.amountCents));
  const voucher = Math.max(0, Math.floor(input.voucherCents));
  const applied = Math.min(amount, voucher);
  return {
    amountCents: amount,
    voucherCents: applied,
    netAmountCents: amount - applied,
  };
}

export function formatCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}
