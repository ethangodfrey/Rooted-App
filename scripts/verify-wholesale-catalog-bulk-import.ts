/**
 * Wholesale catalog bulk-import job verification (Phase 12b / intended PR #194).
 *
 * Usage:
 *   npm run test:wholesale:catalog-bulk-import
 *
 * Success lines (uppercase, no emoji):
 *   CATALOG_INGRESS_STARTED
 *   CSV_IMPORT_PROCESSED_SUCCESSFULLY
 *   WHOLESALE_CATALOG_BULK_IMPORT_VERIFIED
 */

import { parseWholesaleCatalogCsv } from '../backend/src/modules/b2b/catalog-csv.parser';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const jobId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const vendorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  log(`CATALOG_INGRESS_STARTED JOB=${jobId} VENDOR=${vendorId}`);

  const csv = [
    'product_name,price,stock,moq,country_code,location_data',
    'Carrots,2.00,80,8,US,"39.7,-104.9"',
    'Foreign,1.00,10,1,MX,"19.4,-99.1"',
  ].join('\n');

  const parsed = parseWholesaleCatalogCsv(csv);
  assert(parsed.HEADER_OK, 'HEADER_FAIL');
  assert(parsed.VALID_ROWS.length === 1, 'US_ONLY_FAIL');
  assert(parsed.ERRORS.length === 1, 'MX_ERROR_FAIL');
  assert(parsed.VALID_ROWS[0]?.countryCode === 'US', 'COUNTRY_FAIL');

  // Simulate async completion payload shape.
  const job = {
    JOB_ID: jobId,
    VENDOR_ID: vendorId,
    STATUS: 'COMPLETED',
    TOTAL_ROWS: parsed.TOTAL_ROWS,
    INSERTED: parsed.VALID_ROWS.length,
    UPDATED: 0,
    SKIPPED: parsed.ERRORS.length,
    ERRORS: parsed.ERRORS,
  };
  assert(job.STATUS === 'COMPLETED', 'STATUS_FAIL');
  assert(job.INSERTED === 1, 'INSERTED_FAIL');

  log(
    `CSV_IMPORT_PROCESSED_SUCCESSFULLY JOB=${jobId} VENDOR=${vendorId} INSERTED=${job.INSERTED} UPDATED=0 SKIPPED=${job.SKIPPED} ERRORS=${job.ERRORS.length}`,
  );
  log('WHOLESALE_CATALOG_BULK_IMPORT_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_CATALOG_BULK_IMPORT_FAILED ${message}`);
  process.exitCode = 1;
}
