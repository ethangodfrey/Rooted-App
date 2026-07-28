import {
  applyVoucherToAmount,
  formatCents,
  formatEscrowLedgerActiveLog,
  formatFinancialEngineInitializedLog,
  formatFinancialUiActiveLog,
  normalizeFinancialStatus,
  normalizeFinancialType,
} from './financial.util';

describe('normalizeFinancialStatus', () => {
  it('returns null for empty or unknown values', () => {
    expect(normalizeFinancialStatus(undefined)).toBeNull();
    expect(normalizeFinancialStatus(null)).toBeNull();
    expect(normalizeFinancialStatus('')).toBeNull();
    expect(normalizeFinancialStatus('  ')).toBeNull();
    expect(normalizeFinancialStatus('CHARGEBACK')).toBeNull();
  });

  it('normalizes supported financial statuses', () => {
    expect(normalizeFinancialStatus('held_in_escrow')).toBe('HELD_IN_ESCROW');
    expect(normalizeFinancialStatus(' SETTLED ')).toBe('SETTLED');
    expect(normalizeFinancialStatus('refunded')).toBe('REFUNDED');
  });
});

describe('normalizeFinancialType', () => {
  it('returns null for empty or unknown values', () => {
    expect(normalizeFinancialType(undefined)).toBeNull();
    expect(normalizeFinancialType('ORDER')).toBeNull();
  });

  it('normalizes supported financial transaction types', () => {
    expect(normalizeFinancialType('wholesale')).toBe('WHOLESALE');
    expect(normalizeFinancialType(' CATERING_DEPOSIT ')).toBe('CATERING_DEPOSIT');
    expect(normalizeFinancialType('loyalty_boost')).toBe('LOYALTY_BOOST');
  });
});

describe('applyVoucherToAmount', () => {
  it('applies voucher cents up to the gross amount', () => {
    expect(
      applyVoucherToAmount({ amountCents: 1500, voucherCents: 500 }),
    ).toEqual({
      amountCents: 1500,
      voucherCents: 500,
      netAmountCents: 1000,
    });
  });

  it('caps voucher application at the gross amount', () => {
    expect(
      applyVoucherToAmount({ amountCents: 800, voucherCents: 1200 }),
    ).toEqual({
      amountCents: 800,
      voucherCents: 800,
      netAmountCents: 0,
    });
  });

  it('clamps negative inputs to zero and never returns negative net totals', () => {
    expect(
      applyVoucherToAmount({ amountCents: -100, voucherCents: -50 }),
    ).toEqual({
      amountCents: 0,
      voucherCents: 0,
      netAmountCents: 0,
    });
  });

  it('floors fractional cent inputs', () => {
    expect(
      applyVoucherToAmount({ amountCents: 1000.9, voucherCents: 200.8 }),
    ).toEqual({
      amountCents: 1000,
      voucherCents: 200,
      netAmountCents: 800,
    });
  });
});

describe('formatCents', () => {
  it('formats non-negative cent amounts as USD strings', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(1250)).toBe('$12.50');
  });

  it('clamps negative values to zero dollars', () => {
    expect(formatCents(-500)).toBe('$0.00');
  });
});

describe('financial telemetry helpers', () => {
  it('formats engine initialization logs', () => {
    expect(formatFinancialEngineInitializedLog()).toBe(
      'FINANCIAL_ENGINE_INITIALIZED SERVICE=PaymentClearingService',
    );
  });

  it('formats escrow ledger logs with optional fields', () => {
    expect(formatEscrowLedgerActiveLog()).toBe('ESCROW_LEDGER_ACTIVE');
    expect(
      formatEscrowLedgerActiveLog({
        transactionId: 'tx-1',
        status: 'HELD_IN_ESCROW',
        netCents: 1800,
      }),
    ).toBe('ESCROW_LEDGER_ACTIVE TX=tx-1 STATUS=HELD_IN_ESCROW NET_CENTS=1800');
  });

  it('formats financial UI telemetry logs', () => {
    expect(formatFinancialUiActiveLog()).toBe('FINANCIAL_UI_ACTIVE');
    expect(formatFinancialUiActiveLog({ availableCents: 4200 })).toBe(
      'FINANCIAL_UI_ACTIVE AVAILABLE_CENTS=4200',
    );
  });
});
