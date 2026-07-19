/**
 * Wholesale order draft payload assembly verification.
 *
 * Usage:
 *   npm run test:wholesale:order-draft
 *
 * Success lines (uppercase, no emoji):
 *   WHOLESALE_PAYLOAD_VALID
 *   ORDER_DRAFT_INITIALIZED
 *   WHOLESALE_ORDER_DRAFT_VERIFIED
 */

import { parseWholesaleOrderDraftCreate } from '../packages/env-config/src/b2b';
import { assembleWholesaleOrderPayload } from '../tenant-web/src/lib/b2b/order-draft';
import type { WholesaleProductRow } from '../tenant-web/src/lib/b2b/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const buyer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const seller = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const product: WholesaleProductRow = {
    ID: '11111111-1111-4111-8111-111111111111',
    VENDOR_ID: seller,
    NAME: 'Heirloom Tomato Case',
    PACKAGING_UNIT: 'CASE',
    WEIGHT_LBS: 22.5,
    MOQ: 5,
    UNIT_PRICE_CENTS: 2400,
    PRICING_TIERS: [
      { minQty: 50, unitPriceCents: 2200 },
      { minQty: 100, unitPriceCents: 2000 },
    ],
    FREIGHT_NOTES: null,
    PICKUP_NOTES: null,
    STATUS: 'ACTIVE',
  };

  const blocked = assembleWholesaleOrderPayload({
    buyerVendorId: buyer,
    sellerVendorId: seller,
    lines: [{ product, quantity: 2 }],
  });
  assert(!blocked.valid, 'MOQ_FAIL SHOULD_BLOCK');
  assert(
    blocked.reason?.startsWith('MOQ_GUARD_ACTIVE') ?? false,
    'MOQ_FAIL REASON',
  );
  log('MOQ_GUARD_ACTIVE QTY=2 MOQ=5');

  const assembled = assembleWholesaleOrderPayload({
    buyerVendorId: buyer,
    sellerVendorId: seller,
    lines: [{ product, quantity: 100 }],
  });
  assert(assembled.valid, 'PAYLOAD_FAIL VALID');
  assert(assembled.lineCount === 1, 'PAYLOAD_FAIL LINE_COUNT');
  assert(assembled.subtotalCents === 200_000, 'PAYLOAD_FAIL SUBTOTAL');
  assert(
    assembled.payload.items[0]?.negotiated_tier_unit_price === 2000,
    'PAYLOAD_FAIL TIER_PRICE',
  );
  log(
    `WHOLESALE_PAYLOAD_VALID BUYER=${buyer} SELLER=${seller} LINES=1 SUBTOTAL_CENTS=200000`,
  );

  const parsed = parseWholesaleOrderDraftCreate(assembled.payload);
  assert(parsed.OK, 'SCHEMA_FAIL PARSE');
  log('ORDER_DRAFT_INITIALIZED STATUS=SCHEMA_READY');

  const selfBuy = assembleWholesaleOrderPayload({
    buyerVendorId: buyer,
    sellerVendorId: buyer,
    lines: [{ product, quantity: 100 }],
  });
  assert(!selfBuy.valid, 'SELF_FAIL SHOULD_BLOCK');

  log('WHOLESALE_ORDER_DRAFT_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_ORDER_DRAFT_FAILED ${message}`);
  process.exitCode = 1;
}
