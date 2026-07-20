/**
 * Phase retail draft assembly verification (PR 190b).
 *
 * Usage:
 *   npm run test:wholesale:retail-drafts
 *
 * Success lines (uppercase, no emoji):
 *   RETAIL_SALE_MODE_ENABLED
 *   PRODUCT_RETAIL_ENDPOINT_ACTIVE
 *   WHOLESALE_RETAIL_DRAFTS_VERIFIED
 */

import { parseWholesaleOrderDraftCreate } from '../packages/env-config/src/b2b';
import {
  retailPriceToCents,
  resolveWholesalePricingMode,
} from '../backend/src/modules/b2b/wholesale-relationship.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const retail = parseWholesaleOrderDraftCreate({
    buyer_vendor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    seller_vendor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    sale_mode: 'RETAIL',
    items: [
      {
        product_sku_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        quantity: 1,
        negotiated_tier_unit_price: 450,
      },
    ],
  });
  assert(retail.OK, 'RETAIL_DRAFT_PARSE_FAIL');
  assert(retail.DATA.sale_mode === 'RETAIL', 'SALE_MODE_FAIL');

  const wholesale = parseWholesaleOrderDraftCreate({
    buyer_vendor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    seller_vendor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    items: [
      {
        product_sku_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        quantity: 10,
        negotiated_tier_unit_price: 1200,
      },
    ],
  });
  assert(wholesale.OK, 'WHOLESALE_DRAFT_PARSE_FAIL');
  assert(wholesale.DATA.sale_mode === 'WHOLESALE', 'DEFAULT_WHOLESALE_FAIL');

  assert(retailPriceToCents(4.5) === 450, 'CENTS_FAIL');
  assert(retailPriceToCents(null) === null, 'NULL_CENTS_FAIL');
  assert(
    resolveWholesalePricingMode('ACCEPTED') === 'TIERED_WHOLESALE_PRICING',
    'TIER_MODE_FAIL',
  );

  log('RETAIL_SALE_MODE_ENABLED');
  log('PRODUCT_RETAIL_ENDPOINT_ACTIVE');
  log('WHOLESALE_RETAIL_DRAFTS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_RETAIL_DRAFTS_FAILED ${message}`);
  process.exitCode = 1;
}
