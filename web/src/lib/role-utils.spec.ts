import { describe, expect, it } from 'vitest';

import { isCustomerRole } from './role-utils';

describe('isCustomerRole', () => {
  it('returns true for Vendorly customer and legacy shopper roles', () => {
    expect(isCustomerRole('customer')).toBe(true);
    expect(isCustomerRole('shopper')).toBe(true);
  });

  it('returns false for vendor, chef, admin, and other roles', () => {
    expect(isCustomerRole('vendor')).toBe(false);
    expect(isCustomerRole('chef')).toBe(false);
    expect(isCustomerRole('admin')).toBe(false);
    expect(isCustomerRole('farmer')).toBe(false);
  });

  it('returns false for null, undefined, and empty strings', () => {
    expect(isCustomerRole(null)).toBe(false);
    expect(isCustomerRole(undefined)).toBe(false);
    expect(isCustomerRole('')).toBe(false);
  });

  it('is case-sensitive and does not coerce aliases', () => {
    expect(isCustomerRole('Customer')).toBe(false);
    expect(isCustomerRole('SHOPPER')).toBe(false);
    expect(isCustomerRole(' customer ')).toBe(false);
  });
});
