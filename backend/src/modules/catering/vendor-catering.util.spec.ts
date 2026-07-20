import {
  assertCateringGuestRange,
  formatCateringModuleInitializedLog,
  formatVendorServicesUpdatedLog,
  normalizeCateringDescription,
} from './vendor-catering.util';

describe('Vendor catering module', () => {
  it('logs CATERING_MODULE_INITIALIZED', () => {
    expect(formatCateringModuleInitializedLog()).toContain(
      'CATERING_MODULE_INITIALIZED',
    );
  });

  it('validates guest capacity and formats VENDOR_SERVICES_UPDATED', () => {
    assertCateringGuestRange(5, 25);
    expect(() => assertCateringGuestRange(30, 10)).toThrow(/GUEST_RANGE/);
    expect(normalizeCateringDescription('  plated dinners ')).toBe(
      'plated dinners',
    );
    expect(
      formatVendorServicesUpdatedLog({
        vendorId: 'v1',
        enabled: true,
        minGuests: 5,
        maxGuests: 25,
      }),
    ).toContain('VENDOR_SERVICES_UPDATED');
  });
});
