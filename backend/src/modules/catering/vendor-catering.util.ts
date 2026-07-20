/**
 * Vendor catering module helpers.
 * Telemetry: CATERING_MODULE_INITIALIZED, VENDOR_SERVICES_UPDATED
 */

export type CateringServiceInput = {
  serviceDescription: string;
  minGuests: number;
  maxGuests: number;
  priceRangeEstimate?: string | null;
};

export type CateringServiceRecord = CateringServiceInput & {
  vendorId: string;
  isCateringProvider: boolean;
};

export function formatCateringModuleInitializedLog(): string {
  return 'CATERING_MODULE_INITIALIZED SERVICE=VendorCateringService';
}

export function formatVendorServicesUpdatedLog(input: {
  vendorId: string;
  enabled: boolean;
  minGuests: number;
  maxGuests: number;
}): string {
  return `VENDOR_SERVICES_UPDATED VENDOR=${input.vendorId} ENABLED=${input.enabled ? '1' : '0'} MIN_GUESTS=${input.minGuests} MAX_GUESTS=${input.maxGuests}`;
}

export function assertCateringGuestRange(minGuests: number, maxGuests: number): void {
  if (!Number.isFinite(minGuests) || minGuests < 1) {
    throw new Error('CATERING_FAIL MIN_GUESTS');
  }
  if (!Number.isFinite(maxGuests) || maxGuests < 1) {
    throw new Error('CATERING_FAIL MAX_GUESTS');
  }
  if (maxGuests < minGuests) {
    throw new Error('CATERING_FAIL GUEST_RANGE');
  }
}

export function normalizeCateringDescription(value: string | null | undefined): string {
  return (value ?? '').trim();
}
