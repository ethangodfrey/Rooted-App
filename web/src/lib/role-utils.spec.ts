import { describe, expect, it } from 'vitest';

import { isCustomerRole } from './role-utils';

describe('isCustomerRole', () => {
  it('returns true for Vendorly customer and legacy shopper roles', () => {
    expect(isCustomerRole('customer')).toBe(true);
    expect(isCustomerRole('shopper')).toBe(true);
  });

  it('returns false for vendor, chef, admin, and unknown roles', () => {
    expect(isCustomerRole('vendor')).toBe(false);
    expect(isCustomerRole('chef')).toBe(false);
    expect(isCustomerRole('admin')).toBe(false);
    expect(isCustomerRole('unknown')).toBe(false);
  });

  it('returns false for null, undefined, and empty strings', () => {
    expect(isCustomerRole(null)).toBe(false);
    expect(isCustomerRole(undefined)).toBe(false);
    expect(isCustomerRole('')).toBe(false);
  });
});
