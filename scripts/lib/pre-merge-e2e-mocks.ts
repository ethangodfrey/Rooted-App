/**
 * Mock payloads for the pre-merge E2E integration audit.
 * Uppercase text-only tracing only — no emoji.
 *
 * Denver remains a convenience sample; nationwide coverage lives in
 * @vendorly/env-config US_STATE_GEO_FIXTURES + verify-nationwide-routing.ts.
 */

import { getStateGeoFixture } from '@vendorly/env-config';

export const PLATFORM_DOMAIN = 'vendorlymarketplace.com';

const DENVER = getStateGeoFixture('CO');

export const MOCK_TENANT_HOST = `${DENVER?.TENANT_SLUG ?? 'denver'}.vendorlymarketplace.com`;

export const MOCK_TENANT_SLUG = DENVER?.TENANT_SLUG ?? 'denver';

/** Denver representative coordinates (from 50-state fixture map). */
export const MOCK_DENVER_GEO = {
  LATITUDE: DENVER?.LATITUDE ?? 39.7392,
  LONGITUDE: DENVER?.LONGITUDE ?? -104.9903,
  RADIUS_MILES: 25,
} as const;

export const MOCK_WHOLESALE_PRODUCT_VALID = {
  name: 'Heirloom Tomato Case',
  description: 'Bulk case for partner vendors',
  packagingUnit: 'CASE',
  weightLbs: 20,
  moq: 5,
  unitPriceCents: 2400,
  pricingTiers: [
    { minQty: 10, unitPriceCents: 2200 },
    { minQty: 25, unitPriceCents: 2000 },
  ],
  freightNotes: 'Pallet preferred',
  pickupNotes: 'Dock B morning window',
} as const;

export const MOCK_WHOLESALE_PRODUCT_INVALID_MOQ = {
  name: 'Broken MOQ SKU',
  packagingUnit: 'CASE',
  weightLbs: 10,
  moq: 0,
  unitPriceCents: 1000,
  pricingTiers: [],
} as const;

export const MOCK_WHOLESALE_CATALOG_ROW = {
  ID: '11111111-1111-4111-8111-111111111111',
  VENDOR_ID: '22222222-2222-4222-8222-222222222222',
  NAME: 'Heirloom Tomato Case',
  PACKAGING_UNIT: 'CASE',
  WEIGHT_LBS: 20,
  MOQ: 5,
  UNIT_PRICE_CENTS: 2400,
  PRICING_TIERS: [
    { minQty: 10, unitPriceCents: 2200 },
    { minQty: 25, unitPriceCents: 2000 },
  ],
  STATUS: 'ACTIVE',
} as const;

export const MOCK_BEARER_TOKEN = 'audit-mock-bearer-token';

export function mockWholesaleProxyPath(query?: Record<string, string>): string {
  const qs = query ? new URLSearchParams(query).toString() : '';
  return `/api/vendors/wholesale-products${qs ? `?${qs}` : ''}`;
}

export function mockNestForwardUrl(apiBase: string, path: string): string {
  const base = apiBase.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
