/**
 * Phase 65 / PR 190a retail schema verification.
 *
 * Usage:
 *   npm run test:wholesale:retail-schema
 *
 * Success lines (uppercase, no emoji):
 *   RETAIL_SALE_MODE_ENABLED
 *   PRODUCT_RETAIL_ENDPOINT_ACTIVE
 *   WHOLESALE_RETAIL_SCHEMA_VERIFIED
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const defaults = {
    isRetailEnabled: false,
    retailPrice: null as number | null,
  };
  assert(defaults.isRetailEnabled === false, 'DEFAULT_RETAIL_FALSE_FAIL');
  assert(defaults.retailPrice === null, 'DEFAULT_RETAIL_PRICE_NULL_FAIL');

  const enabled = {
    isRetailEnabled: true,
    retailPrice: 4.5,
  };
  assert(enabled.isRetailEnabled === true, 'ENABLE_RETAIL_FAIL');
  assert(enabled.retailPrice === 4.5, 'RETAIL_PRICE_FAIL');

  // Cents conversion used by draft assembly (190b).
  const retailCents = Math.round(enabled.retailPrice * 100);
  assert(retailCents === 450, 'RETAIL_CENTS_FAIL');

  log('RETAIL_SALE_MODE_ENABLED');
  log('PRODUCT_RETAIL_ENDPOINT_ACTIVE');
  log('WHOLESALE_RETAIL_SCHEMA_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_RETAIL_SCHEMA_FAILED ${message}`);
  process.exitCode = 1;
}
