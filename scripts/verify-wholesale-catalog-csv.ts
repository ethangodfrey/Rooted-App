/**
 * Wholesale catalog CSV parser verification (Phase 12a / intended PR #193).
 *
 * Usage:
 *   npm run test:wholesale:catalog-csv
 *
 * Success lines (uppercase, no emoji):
 *   CATALOG_INGRESS_STARTED
 *   CSV_IMPORT_PROCESSED_SUCCESSFULLY
 *   WHOLESALE_CATALOG_CSV_VERIFIED
 */

import {
  mapWholesaleCatalogCsvRow,
  parseLocationData,
  parseWholesaleCatalogCsv,
} from '../backend/src/modules/b2b/catalog-csv.parser';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log('CATALOG_INGRESS_STARTED');

  const loc = parseLocationData('39.7392,-104.9903');
  assert(loc.OK && loc.DATA?.latitude === 39.7392, 'LOC_CSV_FAIL');

  const badLoc = parseLocationData('not-a-location');
  assert(!badLoc.OK, 'BAD_LOC_SHOULD_FAIL');

  const nonUs = mapWholesaleCatalogCsvRow(
    {
      product_name: 'Tomatoes',
      price: '4.50',
      stock: '100',
      moq: '10',
      country_code: 'CA',
      location_data: '45.5,-73.5',
    },
    2,
  );
  assert(!nonUs.OK, 'NON_US_SHOULD_FAIL');

  const ok = mapWholesaleCatalogCsvRow(
    {
      product_name: 'Heirloom Tomatoes',
      price: '4.50',
      stock: '100',
      moq: '10',
      country_code: 'US',
      location_data: '39.7392,-104.9903',
    },
    2,
  );
  assert(ok.OK, 'MAP_OK_FAIL');
  assert(ok.DATA.unitPriceCents === 450, 'PRICE_CENTS_FAIL');
  assert(ok.DATA.availableQuantity === 100, 'STOCK_FAIL');
  assert(ok.DATA.moq === 10, 'MOQ_FAIL');
  assert(ok.DATA.countryCode === 'US', 'COUNTRY_FAIL');
  assert(ok.DATA.packagingUnit === 'EACH', 'PACKAGING_DEFAULT_FAIL');

  const csv = [
    'product_name,price,stock,moq,country_code,location_data',
    'Apples,3.00,50,5,USA,"40.0,-105.0"',
    'Bad,,10,1,US,',
    'Beets,2.25,20,2,US,',
  ].join('\n');

  const parsed = parseWholesaleCatalogCsv(csv);
  assert(parsed.HEADER_OK, 'HEADER_FAIL');
  assert(parsed.TOTAL_ROWS === 3, 'TOTAL_ROWS_FAIL');
  assert(parsed.VALID_ROWS.length === 2, 'VALID_ROWS_FAIL');
  assert(parsed.ERRORS.length === 1, 'ERROR_COUNT_FAIL');
  assert(parsed.VALID_ROWS[0]?.name === 'Apples', 'FIRST_NAME_FAIL');
  assert(parsed.VALID_ROWS[0]?.unitPriceCents === 300, 'FIRST_PRICE_FAIL');

  log('CSV_IMPORT_PROCESSED_SUCCESSFULLY');
  log('WHOLESALE_CATALOG_CSV_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_CATALOG_CSV_FAILED ${message}`);
  process.exitCode = 1;
}
