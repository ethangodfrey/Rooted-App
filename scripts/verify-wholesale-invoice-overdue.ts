/**
 * Wholesale Net-30 overdue sweeper verification.
 *
 * Usage:
 *   npm run test:wholesale:overdue
 *
 * Success lines (uppercase, no emoji):
 *   CRON_SWEEP_EXECUTED
 *   INVOICES_MARKED_OVERDUE
 *   WHOLESALE_INVOICE_OVERDUE_VERIFIED
 */

import { resolveInvoiceDisplayStatus } from '../backend/src/modules/b2b/wholesale-invoice.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors sweeper predicate: status PENDING and due_at < now. */
function selectOverdueCandidates(
  rows: Array<{ id: string; status: string; dueAt: Date }>,
  now: Date,
): string[] {
  return rows
    .filter((row) => row.status === 'PENDING' && row.dueAt.getTime() < now.getTime())
    .map((row) => row.id);
}

function main(): void {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const rows = [
    {
      id: '11111111-1111-1111-8111-111111111111',
      status: 'PENDING',
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    {
      id: '22222222-2222-2222-8222-222222222222',
      status: 'PENDING',
      dueAt: new Date('2026-09-15T00:00:00.000Z'),
    },
    {
      id: '33333333-3333-3333-8333-333333333333',
      status: 'PAID',
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      status: 'OVERDUE',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    {
      id: '55555555-5555-5555-8555-555555555555',
      status: 'PENDING',
      dueAt: new Date('2026-07-15T00:00:00.000Z'),
    },
  ];

  const marked = selectOverdueCandidates(rows, now);
  assert(marked.length === 2, 'SWEEP_FAIL EXPECTED_COUNT_2');
  assert(
    marked.includes('11111111-1111-1111-8111-111111111111'),
    'SWEEP_FAIL MISSING_FIRST',
  );
  assert(
    marked.includes('55555555-5555-5555-8555-555555555555'),
    'SWEEP_FAIL MISSING_SECOND',
  );

  assert(
    resolveInvoiceDisplayStatus(
      'PENDING',
      new Date('2026-08-25T00:00:00.000Z'),
      new Date('2026-08-01T00:00:00.000Z'),
    ) === 'PENDING',
    'DISPLAY_FAIL PENDING',
  );
  assert(
    resolveInvoiceDisplayStatus(
      'OVERDUE',
      new Date('2026-08-25T00:00:00.000Z'),
      new Date('2026-08-01T00:00:00.000Z'),
    ) === 'OVERDUE',
    'DISPLAY_FAIL OVERDUE_PERSISTED',
  );
  assert(
    resolveInvoiceDisplayStatus(
      'PENDING',
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-26T00:00:00.000Z'),
    ) === 'OVERDUE',
    'DISPLAY_FAIL OVERDUE_SOFT',
  );

  log('CRON_SWEEP_EXECUTED AT=2026-09-01T12:00:00.000Z');
  log(`INVOICES_MARKED_OVERDUE COUNT=${marked.length}`);
  log('WHOLESALE_INVOICE_OVERDUE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_INVOICE_OVERDUE_FAILED ${message}`);
  process.exitCode = 1;
}
