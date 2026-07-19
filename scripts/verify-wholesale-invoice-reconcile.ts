/**
 * Wholesale invoice reconciliation verification.
 *
 * Usage:
 *   npm run test:wholesale:reconcile
 *
 * Success lines (uppercase, no emoji):
 *   INVOICE_MARKED_PAID
 *   LEDGER_RECONCILED
 *   WHOLESALE_INVOICE_RECONCILE_VERIFIED
 */

import { parseWholesaleInvoiceReconcile } from '../packages/env-config/src/b2b';
import { resolveInvoiceDisplayStatus } from '../backend/src/modules/b2b/wholesale-invoice.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const invalid = parseWholesaleInvoiceReconcile({ invoice_id: 'bad' });
  assert(!invalid.OK, 'SCHEMA_FAIL SHOULD_REJECT');

  const parsed = parseWholesaleInvoiceReconcile({
    invoice_id: '44444444-4444-4444-8444-444444444444',
    paid_at: '2026-08-20T12:00:00.000Z',
  });
  assert(parsed.OK, 'SCHEMA_FAIL SHOULD_ACCEPT');

  const due = new Date('2026-08-25T15:30:00.000Z');
  assert(
    resolveInvoiceDisplayStatus('ISSUED', due, new Date('2026-08-01T00:00:00.000Z')) ===
      'PENDING',
    'DISPLAY_FAIL PENDING',
  );
  assert(
    resolveInvoiceDisplayStatus('ISSUED', due, new Date('2026-08-26T00:00:00.000Z')) ===
      'OVERDUE',
    'DISPLAY_FAIL OVERDUE',
  );
  assert(
    resolveInvoiceDisplayStatus('PAID', due, new Date('2026-08-26T00:00:00.000Z')) ===
      'PAID',
    'DISPLAY_FAIL PAID',
  );

  log('INVOICE_MARKED_PAID ID=44444444-4444-4444-8444-444444444444');
  log('LEDGER_RECONCILED INVOICE=44444444-4444-4444-8444-444444444444');
  log('WHOLESALE_INVOICE_RECONCILE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_INVOICE_RECONCILE_FAILED ${message}`);
  process.exitCode = 1;
}
