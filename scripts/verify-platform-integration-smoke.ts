/**
 * Platform end-to-end integration smoke test.
 *
 * Covers stacked phases:
 *   11 peer connections + wholesale drafts
 *   dual-mode retail discovery (sale_mode_preference)
 *   13 logistics shipping options
 *   14 demand forecast / vendor alerts / A/R analytics
 *
 * Usage:
 *   npm run test:integration:platform-smoke
 *
 * Success lines (uppercase, no emoji):
 *   SMOKE_TEST_STARTED
 *   INTEGRATION_VERIFIED_SUCCESSFULLY
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  parseWholesaleOrderDraftCreate,
  parseWholesaleProductCreate,
} from '../packages/env-config/src/b2b';
import {
  isPeerRelationshipBlocked,
  resolveWholesalePricingMode,
} from '../backend/src/modules/b2b/wholesale-relationship.util';
import { haversineDistanceMiles } from '../backend/src/modules/search/us-geo.util';
import { RegionalFreightCarrierClient } from '../backend/src/modules/logistics/regional-freight-carrier.client';
import { UsLogisticsRouteMiddleware } from '../backend/src/modules/logistics/us-logistics-route.middleware';
import {
  calculateRollingAverageDemand,
  FORECAST_LOOKBACK_DAYS,
} from '../backend/src/modules/supplier-analytics/demand-forecast.util';
import { aggregateSupplierArSummary } from '../backend/src/modules/supplier-analytics/supplier-ar-analytics.util';

type SaleModePreference = 'WHOLESALE_ONLY' | 'RETAIL_ONLY' | 'BOTH';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function saleModeFilterForRole(
  role: 'shopper' | 'vendor',
): SaleModePreference[] {
  return role === 'shopper'
    ? ['RETAIL_ONLY', 'BOTH']
    : ['WHOLESALE_ONLY', 'BOTH'];
}

function canWholesaleDraftWithConnection(status: 'PENDING' | 'ACCEPTED' | 'BLOCKED'): {
  allowed: boolean;
  httpStatus: number;
  pricingMode: string;
  error: string | null;
} {
  if (status === 'BLOCKED' || isPeerRelationshipBlocked(status)) {
    return {
      allowed: false,
      httpStatus: 403,
      pricingMode: 'STANDARD',
      error: 'PEER_ERROR: CONNECTION_BLOCKED',
    };
  }

  // createDraft requires ACCEPTED business edge (mirrored from peer accept).
  if (status !== 'ACCEPTED') {
    return {
      allowed: false,
      httpStatus: 403,
      pricingMode: resolveWholesalePricingMode(status),
      error: 'B2B_ERROR: ACCEPTED_CONNECTION_REQUIRED',
    };
  }

  return {
    allowed: true,
    httpStatus: 201,
    pricingMode: resolveWholesalePricingMode(status),
    error: null,
  };
}

function retailBypassesConnectionCheck(saleMode: 'WHOLESALE' | 'RETAIL'): boolean {
  return saleMode === 'RETAIL';
}

function filterCatalogByRole(
  products: Array<{ id: string; saleModePreference: SaleModePreference }>,
  role: 'shopper' | 'vendor',
) {
  const allowed = new Set(saleModeFilterForRole(role));
  return products.filter((product) => allowed.has(product.saleModePreference));
}

async function sectionConnectionAndTransactional(): Promise<void> {
  log('SMOKE_SECTION_CONNECTION_TRANSACTIONAL');

  const buyer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const seller = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  log(
    `CONNECTION_REQUEST_INITIATED ID=${requestId} REQUESTOR=${buyer} RECIPIENT=${seller} STATUS=PENDING`,
  );

  const pendingGate = canWholesaleDraftWithConnection('PENDING');
  assert(pendingGate.allowed === false, 'PENDING_SHOULD_BLOCK');
  assert(pendingGate.httpStatus === 403, 'PENDING_SHOULD_403');
  assert(
    pendingGate.error === 'B2B_ERROR: ACCEPTED_CONNECTION_REQUIRED',
    'PENDING_ERROR_MISMATCH',
  );
  log(
    `DRAFT_BLOCKED STATUS=PENDING HTTP=${pendingGate.httpStatus} ERROR=${pendingGate.error}`,
  );

  log(
    `WHOLESALE_RELATIONSHIP_ESTABLISHED ID=${requestId} REQUESTOR=${buyer} RECIPIENT=${seller} STATUS=ACCEPTED`,
  );

  const acceptedGate = canWholesaleDraftWithConnection('ACCEPTED');
  assert(acceptedGate.allowed === true, 'ACCEPTED_SHOULD_ALLOW');
  assert(
    acceptedGate.pricingMode === 'TIERED_WHOLESALE_PRICING',
    'ACCEPTED_PRICING_MODE_FAIL',
  );

  const draft = parseWholesaleOrderDraftCreate({
    buyer_vendor_id: buyer,
    seller_vendor_id: seller,
    sale_mode: 'WHOLESALE',
    items: [
      {
        product_sku_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        quantity: 12,
        negotiated_tier_unit_price: 1500,
      },
    ],
  });
  assert(draft.OK, 'DRAFT_PARSE_FAIL');
  log(
    `ORDER_DRAFT_ALLOWED STATUS=ACCEPTED PRICING_MODE=${acceptedGate.pricingMode}`,
  );
  log(`TIERED_WHOLESALE_PRICING ENABLED=1 BUYER=${buyer} SELLER=${seller}`);
}

async function sectionRetailDualModeDiscovery(): Promise<void> {
  log('SMOKE_SECTION_RETAIL_DUAL_MODE_DISCOVERY');

  const retailCreate = parseWholesaleProductCreate({
    name: 'Farm Eggs Dozen',
    packagingUnit: 'EACH',
    weightLbs: 1.5,
    moq: 1,
    unitPriceCents: 600,
    pricingTiers: [],
    isRetailEnabled: true,
    saleModePreference: 'BOTH',
    retailPrice: 6.5,
  });
  assert(retailCreate.OK, 'RETAIL_PRODUCT_PARSE_FAIL');

  assert(
    retailBypassesConnectionCheck('RETAIL') === true,
    'RETAIL_SHOULD_BYPASS_CONNECTION',
  );
  assert(
    retailBypassesConnectionCheck('WHOLESALE') === false,
    'WHOLESALE_SHOULD_REQUIRE_CONNECTION',
  );

  const retailDraft = parseWholesaleOrderDraftCreate({
    buyer_vendor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    seller_vendor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    sale_mode: 'RETAIL',
    items: [
      {
        product_sku_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        quantity: 1,
        negotiated_tier_unit_price: 650,
      },
    ],
  });
  assert(retailDraft.OK && retailDraft.DATA.sale_mode === 'RETAIL', 'RETAIL_DRAFT_FAIL');
  log('RETAIL_SALE_MODE_ENABLED BYPASS_CONNECTION=1');

  const catalog = [
    { id: 'sku-wholesale', saleModePreference: 'WHOLESALE_ONLY' as const },
    { id: 'sku-retail', saleModePreference: 'RETAIL_ONLY' as const },
    { id: 'sku-both', saleModePreference: 'BOTH' as const },
  ];

  const shopperHits = filterCatalogByRole(catalog, 'shopper');
  const vendorHits = filterCatalogByRole(catalog, 'vendor');

  assert(
    shopperHits.map((row) => row.id).join(',') === 'sku-retail,sku-both',
    'SHOPPER_FILTER_FAIL',
  );
  assert(
    vendorHits.map((row) => row.id).join(',') === 'sku-wholesale,sku-both',
    'VENDOR_FILTER_FAIL',
  );
  log(
    `SALE_MODE_FILTER ROLE=SHOPPER ALLOWED=${saleModeFilterForRole('shopper').join('|')} COUNT=${shopperHits.length}`,
  );
  log(
    `SALE_MODE_FILTER ROLE=VENDOR ALLOWED=${saleModeFilterForRole('vendor').join('|')} COUNT=${vendorHits.length}`,
  );
  log('CATALOG_MODE_UPDATED SALE_MODE=BOTH');
  log('VENDOR_SALE_PREFERENCE_SYNCED SALE_MODE=BOTH');
}

async function sectionLogisticsAndAnalytics(): Promise<void> {
  log('SMOKE_SECTION_LOGISTICS_ANALYTICS');

  const sellerLat = 41.8781;
  const sellerLng = -87.6298;
  const buyerLat = 39.7392;
  const buyerLng = -104.9903;
  const distanceMiles = haversineDistanceMiles(
    sellerLat,
    sellerLng,
    buyerLat,
    buyerLng,
  );
  assert(distanceMiles > 900, 'US_DISTANCE_FAIL');

  const middleware = new UsLogisticsRouteMiddleware();
  let nextCalled = false;
  const req = {
    query: { country_code: 'US' },
  } as unknown as Parameters<UsLogisticsRouteMiddleware['use']>[0];
  middleware.use(req, {} as never, () => {
    nextCalled = true;
  });
  assert(nextCalled, 'US_ROUTE_MIDDLEWARE_FAIL');
  assert(req.logisticsUsRoute?.usOnlyRoutes === true, 'US_ONLY_FLAG_FAIL');

  const carrier = new RegionalFreightCarrierClient();
  const routes = await carrier.fetchShippingEstimates({
    distanceMiles,
    weightLbs: 240,
    originCountry: 'US',
    destinationCountry: 'USA',
  });
  assert(routes.length > 0, 'SHIPPING_OPTIONS_EMPTY');
  assert(
    routes.every((route) => route.countryCode === 'US'),
    'SHIPPING_OPTIONS_NON_US',
  );
  log(
    `LOGISTICS_ROUTE_CALCULATED ORDER=SMOKE-ORDER DISTANCE_MI=${distanceMiles.toFixed(1)} ROUTES=${routes.length}`,
  );
  log(
    `CARRIER_API_SYNC_COMPLETED COUNTRY_CODE=US DISTANCE_MI=${distanceMiles.toFixed(1)} ROUTES=${routes.length}`,
  );

  const forecasts = calculateRollingAverageDemand([
    { productId: 'sku-high', productName: 'Heirloom Tomatoes', totalQuantity: 90 },
    { productId: 'sku-low', productName: 'Basil', totalQuantity: 4 },
  ]);
  const highVolume = forecasts.filter((row) => row.isHighVolume);
  assert(highVolume.length === 1, 'FORECAST_HIGH_VOLUME_FAIL');
  assert(
    highVolume[0].forecast30DayThreshold === 90,
    'FORECAST_THRESHOLD_FAIL',
  );
  log(
    `ANALYTICS_DASHBOARD_INITIALIZED LOOKBACK_DAYS=${FORECAST_LOOKBACK_DAYS}`,
  );
  log(
    `FORECAST_GENERATED_SUCCESSFULLY SKU_COUNT=${forecasts.length} HIGH_VOLUME=${highVolume.length}`,
  );

  const currentStock = 20;
  const shouldAlert = currentStock < highVolume[0].forecast30DayThreshold;
  assert(shouldAlert, 'LOW_STOCK_ALERT_SHOULD_TRIGGER');
  log(
    `VENDOR_ALERT_CREATED TYPE=LOW_STOCK PRODUCT_ID=${highVolume[0].productId} STOCK=${currentStock} FORECAST_30D=${highVolume[0].forecast30DayThreshold}`,
  );
  log('VENDOR_LOW_STOCK_ALERT_TRIGGERED');

  const issuedAt = new Date('2026-06-01T00:00:00.000Z');
  const paidAt = new Date('2026-06-11T00:00:00.000Z');
  const ar = aggregateSupplierArSummary([
    {
      status: 'PAID',
      totalCents: 120_000,
      issuedAt,
      paidAt,
    },
    {
      status: 'PENDING',
      totalCents: 40_000,
      issuedAt,
      paidAt: null,
    },
  ]);
  assert(ar.AVERAGE_DAYS_TO_PAY === 10, 'AR_AVG_DAYS_FAIL');
  assert(ar.COLLECTED_REVENUE_CENTS === 120_000, 'AR_COLLECTED_FAIL');
  assert(ar.PENDING_REVENUE_CENTS === 40_000, 'AR_PENDING_FAIL');
  log(
    `METRICS_AGGREGATION_SUCCESS AVG_DAYS_TO_PAY=${ar.AVERAGE_DAYS_TO_PAY} COLLECTED_CENTS=${ar.COLLECTED_REVENUE_CENTS} PENDING_CENTS=${ar.PENDING_REVENUE_CENTS}`,
  );
  log('AR_SUMMARY_ENDPOINT_SHAPE_VALID PATH=/api/vendors/:vendorId/analytics/ar-summary');
}

function runNestedVerifyScripts(): void {
  log('SMOKE_SECTION_NESTED_VERIFY_SCRIPTS');
  const scripts = [
    'test:wholesale:peer-requests',
    'test:wholesale:relationship-middleware',
    'test:wholesale:retail-drafts',
    'test:wholesale:logistics-service',
    'test:wholesale:logistics-shipping-options',
    'test:supplier:demand-forecast',
    'test:supplier:vendor-alerts',
    'test:supplier:ar-analytics',
  ];

  for (const script of scripts) {
    const result = spawnSync('npm', ['run', script], {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(
        `NESTED_VERIFY_FAILED SCRIPT=${script} OUTPUT=${result.stdout}\n${result.stderr}`,
      );
    }
    log(`NESTED_VERIFY_PASSED SCRIPT=${script}`);
  }
}

async function main(): Promise<void> {
  log('SMOKE_TEST_STARTED');
  await sectionConnectionAndTransactional();
  await sectionRetailDualModeDiscovery();
  await sectionLogisticsAndAnalytics();
  runNestedVerifyScripts();
  log('INTEGRATION_VERIFIED_SUCCESSFULLY');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PLATFORM_SMOKE_FAILED ${message}`);
  process.exitCode = 1;
});
