/**
 * Phase 14b — vendor low-stock alert verification.
 *
 * Usage:
 *   npm run test:supplier:vendor-alerts
 *
 * Success lines (uppercase, no emoji):
 *   LOW_STOCK_ALERT_RULE_VALIDATED
 *   SUPPLIER_VENDOR_ALERTS_VERIFIED
 */

import { FORECAST_LOOKBACK_DAYS, calculateRollingAverageDemand } from '../backend/src/modules/supplier-analytics/demand-forecast.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const forecasts = calculateRollingAverageDemand([
    { productId: 'sku-low', productName: 'Eggs Dozen', totalQuantity: 60 },
  ]);
  const sku = forecasts[0];
  const currentStock = 20;
  const shouldAlert = currentStock < sku.forecast30DayThreshold;
  assert(shouldAlert, 'ALERT_FAIL SHOULD_TRIGGER_LOW_STOCK');
  assert(sku.forecast30DayThreshold === 60, 'ALERT_FAIL FORECAST_THRESHOLD');

  log(
    `LOW_STOCK_ALERT_RULE_VALIDATED PRODUCT_ID=${sku.productId} STOCK=${currentStock} FORECAST_30D=${sku.forecast30DayThreshold} LOOKBACK_DAYS=${FORECAST_LOOKBACK_DAYS}`,
  );
  log('SUPPLIER_VENDOR_ALERTS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SUPPLIER_VENDOR_ALERTS_FAILED ${message}`);
  process.exitCode = 1;
}
