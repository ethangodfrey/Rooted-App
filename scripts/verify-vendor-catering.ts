/**
 * Vendor catering module verification.
 *
 * Usage:
 *   npm run test:vendor:catering
 *
 * Success lines (uppercase, no emoji):
 *   CATERING_MODULE_INITIALIZED
 *   VENDOR_SERVICES_UPDATED
 *   VENDOR_CATERING_VERIFIED
 */

import {
  assertCateringGuestRange,
  formatCateringModuleInitializedLog,
  formatVendorServicesUpdatedLog,
  normalizeCateringDescription,
} from '../backend/src/modules/catering/vendor-catering.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatCateringModuleInitializedLog());

  assertCateringGuestRange(10, 50);
  let rangeFail = false;
  try {
    assertCateringGuestRange(40, 10);
  } catch {
    rangeFail = true;
  }
  assert(rangeFail, 'GUEST_RANGE_SHOULD_FAIL');

  const description = normalizeCateringDescription('  Farm-to-table catering  ');
  assert(description === 'Farm-to-table catering', 'DESCRIPTION_TRIM_FAIL');

  log(
    formatVendorServicesUpdatedLog({
      vendorId: '66666666-6666-4666-8666-666666666666',
      enabled: true,
      minGuests: 10,
      maxGuests: 80,
    }),
  );

  log('VENDOR_CATERING_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`VENDOR_CATERING_FAILED ${message}`);
  process.exitCode = 1;
}
