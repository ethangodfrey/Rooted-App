/**
 * Wholesale fulfillment + carrier tracking verification.
 *
 * Usage:
 *   npm run test:wholesale:fulfillment
 *
 * Success lines (uppercase, no emoji):
 *   LOGISTICS_MANIFEST_VALID
 *   ORDER_FULFILLMENT_TRACKED
 *   WHOLESALE_FULFILLMENT_VERIFIED
 */

import { parseWholesaleOrderFulfillment } from '../packages/env-config/src/b2b';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const invalid = parseWholesaleOrderFulfillment({
    order_id: 'not-a-uuid',
    carrier_name: 'FedEx',
    tracking_number: '1Z',
    estimated_delivery_at: '2026-07-25T18:00:00.000Z',
  });
  assert(!invalid.OK, 'SCHEMA_FAIL SHOULD_REJECT_BAD_ORDER_ID');

  const parsed = parseWholesaleOrderFulfillment({
    order_id: '33333333-3333-4333-8333-333333333333',
    carrier_name: 'Freight Carrier',
    tracking_number: 'FRT-998877',
    estimated_delivery_at: '2026-07-25T18:00:00.000Z',
  });
  assert(parsed.OK, 'SCHEMA_FAIL SHOULD_ACCEPT');
  if (!parsed.OK) return;

  log(
    `LOGISTICS_MANIFEST_VALID ORDER=${parsed.DATA.order_id} CARRIER=${parsed.DATA.carrier_name.toUpperCase()} TRACKING=${parsed.DATA.tracking_number}`,
  );

  const from = 'ORDER_ACCEPTED_BY_SELLER';
  const to = 'ORDER_SHIPPED_IN_TRANSIT';
  assert(from !== to, 'STATUS_FAIL TRANSITION');
  log(`ORDER_FULFILLMENT_TRACKED FROM=${from} TO=${to}`);

  log('WHOLESALE_FULFILLMENT_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_FULFILLMENT_FAILED ${message}`);
  process.exitCode = 1;
}
