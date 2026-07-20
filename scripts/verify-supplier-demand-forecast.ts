/**
 * Phase 14a — demand forecasting engine verification.
 *
 * Usage:
 *   npm run test:supplier:demand-forecast
 *
 * Success lines (uppercase, no emoji):
 *   ANALYTICS_DASHBOARD_INITIALIZED
 *   FORECAST_GENERATED_SUCCESSFULLY
 *   SUPPLIER_DEMAND_FORECAST_VERIFIED
 */

import {
  calculateRollingAverageDemand,
  FORECAST_LOOKBACK_DAYS,
} from '../backend/src/modules/supplier-analytics/demand-forecast.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log('ANALYTICS_DASHBOARD_INITIALIZED');

  const forecasts = calculateRollingAverageDemand([
    { productId: 'sku-a', productName: 'Heirloom Tomatoes', totalQuantity: 120 },
    { productId: 'sku-b', productName: 'Basil Bunch', totalQuantity: 8 },
    { productId: 'sku-c', productName: 'Honey Jar', totalQuantity: 45 },
  ]);

  const highVolume = forecasts.filter((row) => row.isHighVolume);
  assert(highVolume.length === 2, 'FORECAST_FAIL HIGH_VOLUME_COUNT');
  assert(
    forecasts[0].productId === 'sku-a',
    'FORECAST_FAIL SORT_BY_TOTAL_QUANTITY',
  );
  assert(
    forecasts[0].rollingAverageDailyDemand === 4,
    'FORECAST_FAIL ROLLING_AVERAGE',
  );
  assert(
    forecasts[0].forecast30DayThreshold === 120,
    'FORECAST_FAIL THIRTY_DAY_THRESHOLD',
  );

  log(
    `FORECAST_GENERATED_SUCCESSFULLY VENDOR=VERIFY-VENDOR LOOKBACK_DAYS=${FORECAST_LOOKBACK_DAYS} SKU_COUNT=${forecasts.length} HIGH_VOLUME=${highVolume.length}`,
  );
  log('SUPPLIER_DEMAND_FORECAST_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SUPPLIER_DEMAND_FORECAST_FAILED ${message}`);
  process.exitCode = 1;
}
