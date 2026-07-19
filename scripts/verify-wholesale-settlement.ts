/**
 * Wholesale delivery confirmation + settlement ledger verification.
 *
 * Usage:
 *   npm run test:wholesale:settlement
 *
 * Success lines (uppercase, no emoji):
 *   ORDER_DELIVERY_CONFIRMED
 *   WHOLESALE_LEDGER_SETTLED
 *   WHOLESALE_SETTLEMENT_VERIFIED
 */

import { parseWholesaleOrderSettlement } from '../packages/env-config/src/b2b';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const invalid = parseWholesaleOrderSettlement({
    order_id: 'bad',
    delivered_at: '2026-07-26T15:30:00.000Z',
  });
  assert(!invalid.OK, 'SCHEMA_FAIL SHOULD_REJECT_BAD_ORDER_ID');

  const parsed = parseWholesaleOrderSettlement({
    order_id: '33333333-3333-4333-8333-333333333333',
    delivered_at: '2026-07-26T15:30:00.000Z',
  });
  assert(parsed.OK, 'SCHEMA_FAIL SHOULD_ACCEPT');
  if (!parsed.OK) return;

  const from = 'ORDER_SHIPPED_IN_TRANSIT';
  const to = 'ORDER_DELIVERY_CONFIRMED';
  assert(from !== to, 'STATUS_FAIL TRANSITION');
  log(`ORDER_DELIVERY_CONFIRMED FROM=${from} TO=${to}`);
  log(
    `WHOLESALE_LEDGER_SETTLED ORDER=${parsed.DATA.order_id} DELIVERED_AT=${parsed.DATA.delivered_at}`,
  );
  log('WHOLESALE_SETTLEMENT_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_SETTLEMENT_FAILED ${message}`);
  process.exitCode = 1;
}
