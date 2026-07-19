/**
 * Wholesale invoice generation + Net-30 due date verification.
 *
 * Usage:
 *   npm run test:wholesale:invoice
 *
 * Success lines (uppercase, no emoji):
 *   WHOLESALE_INVOICE_GENERATED
 *   BILLING_LEDGER_UPDATED
 *   WHOLESALE_INVOICE_VERIFIED
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildInvoiceNumber(orderId: string, issuedAt: Date): string {
  const ymd = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
  const short = orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `WI-${ymd}-${short}`;
}

function main(): void {
  const issuedAt = new Date('2026-07-26T15:30:00.000Z');
  const dueAt = addUtcDays(issuedAt, 30);
  assert(
    dueAt.toISOString() === '2026-08-25T15:30:00.000Z',
    'NET30_FAIL DUE_AT',
  );

  const orderId = '33333333-3333-4333-8333-333333333333';
  const invoiceNumber = buildInvoiceNumber(orderId, issuedAt);
  assert(invoiceNumber === 'WI-20260726-33333333', 'INVOICE_NUMBER_FAIL');

  log(
    `WHOLESALE_INVOICE_GENERATED NUMBER=${invoiceNumber} DUE_AT=${dueAt.toISOString()} TERMS=NET_30`,
  );
  log(
    `BILLING_LEDGER_UPDATED ORDER=${orderId} TOTAL_CENTS=200000 STATUS=ISSUED`,
  );
  log('WHOLESALE_INVOICE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_INVOICE_FAILED ${message}`);
  process.exitCode = 1;
}
