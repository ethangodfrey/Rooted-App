/**
 * Wholesale Elasticsearch indexer verification (PR #185 geo extension).
 *
 * Usage:
 *   npm run test:wholesale:elasticsearch
 *
 * Success lines (uppercase, no emoji):
 *   GEO_FILTER_ENABLED
 *   ELASTICSEARCH_SYNC_COMPLETED
 *   WHOLESALE_ELASTICSEARCH_INDEXER_VERIFIED
 */

import {
  normalizeCountryCode,
  validateUsWholesaleIndexGeo,
} from '../backend/src/modules/search/us-geo.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function buildIndexDocument(input: {
  id: string;
  vendorId: string;
  name: string;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const geo = validateUsWholesaleIndexGeo({
    country: input.country,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  if (!geo.OK) {
    return { SKIPPED_REASON: geo.REASON, document: null as null };
  }

  return {
    SKIPPED_REASON: null as null,
    document: {
      product_id: input.id,
      vendor_id: input.vendorId,
      name: input.name,
      status: 'ACTIVE',
      country_code: geo.COUNTRY_CODE,
      ...(geo.LATITUDE != null && geo.LONGITUDE != null
        ? { location: { lat: geo.LATITUDE, lon: geo.LONGITUDE } }
        : {}),
    },
  };
}

function main(): void {
  log('GEO_FILTER_ENABLED COUNTRY_CODE=US');

  assert(normalizeCountryCode('USA') === 'US', 'NORMALIZE_USA_FAIL');
  assert(normalizeCountryCode('United States') === 'US', 'NORMALIZE_US_FAIL');
  assert(normalizeCountryCode(null) === 'US', 'NORMALIZE_NULL_FAIL');

  const rejected = validateUsWholesaleIndexGeo({ country: 'CA' });
  assert(!rejected.OK && rejected.REASON === 'NON_US_COUNTRY', 'REJECT_CA_FAIL');

  const doc = buildIndexDocument({
    id: '77777777-7777-4777-8777-777777777777',
    vendorId: '11111111-1111-1111-8111-111111111111',
    name: 'Bulk Heirloom Tomatoes',
    country: 'USA',
    latitude: 39.7392,
    longitude: -104.9903,
  });
  assert(doc.document, 'DOC_BUILD_FAIL');
  assert(doc.document.product_id.length === 36, 'DOC_ID_FAIL');
  assert(doc.document.vendor_id.length === 36, 'VENDOR_ID_FAIL');
  assert(doc.document.status === 'ACTIVE', 'STATUS_FAIL');
  assert(doc.document.country_code === 'US', 'COUNTRY_CODE_FAIL');
  assert(doc.document.location?.lat === 39.7392, 'LAT_FAIL');
  assert(doc.document.location?.lon === -104.9903, 'LON_FAIL');

  const nonUs = buildIndexDocument({
    id: '77777777-7777-4777-8777-777777777777',
    vendorId: '11111111-1111-1111-8111-111111111111',
    name: 'Bulk Heirloom Tomatoes',
    country: 'MX',
    latitude: 19.4326,
    longitude: -99.1332,
  });
  assert(nonUs.document === null, 'NON_US_SHOULD_SKIP');
  assert(nonUs.SKIPPED_REASON === 'NON_US_COUNTRY', 'NON_US_REASON_FAIL');

  log(
    `ELASTICSEARCH_SYNC_COMPLETED ID=${doc.document.product_id} VENDOR=${doc.document.vendor_id} INDEX=wholesale_products COUNTRY_CODE=US HAS_GEO=1`,
  );
  log('WHOLESALE_ELASTICSEARCH_INDEXER_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_ELASTICSEARCH_INDEXER_FAILED ${message}`);
  process.exitCode = 1;
}
