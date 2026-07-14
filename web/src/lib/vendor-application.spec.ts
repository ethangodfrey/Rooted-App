import { describe, expect, it } from 'vitest';

import {
  isVendorApplicationComplete,
  normalizeUrl,
  validateVendorApplication,
  validateVendorApplicationFields,
  type VendorApplicationInput,
} from './vendor-application';

function validInput(overrides: Partial<VendorApplicationInput> = {}): VendorApplicationInput {
  return {
    business_name: 'River Farm',
    product_summary: 'Seasonal vegetables and eggs',
    business_description: 'Small family farm',
    category: 'Food & Drink',
    sell_city: 'Springfield',
    sell_state: 'IL',
    selling_channels: ['Farmers markets'],
    primary_market: 'Downtown Market',
    instagram_url: 'https://instagram.com/riverfarm',
    website_url: null,
    ...overrides,
  };
}

describe('normalizeUrl', () => {
  it('returns null for empty or whitespace-only strings', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('preserves existing http(s) URLs', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('HTTP://Example.COM/path')).toBe('HTTP://Example.COM/path');
  });

  it('prepends https:// to bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('  shop.example.com  ')).toBe('https://shop.example.com');
  });
});

describe('validateVendorApplicationFields', () => {
  it('returns no errors for a complete attested application', () => {
    expect(validateVendorApplicationFields(validInput(), true)).toEqual({});
  });

  it('flags missing required business fields', () => {
    const errors = validateVendorApplicationFields(
      validInput({
        business_name: ' ',
        product_summary: '',
        category: '',
        sell_city: '',
        sell_state: '',
        selling_channels: [],
        instagram_url: null,
        website_url: null,
      }),
      false,
    );

    expect(errors.business_name).toBeTruthy();
    expect(errors.product_summary).toBeTruthy();
    expect(errors.category).toBeTruthy();
    expect(errors.sell_city).toBeTruthy();
    expect(errors.sell_state).toBeTruthy();
    expect(errors.selling_channels).toBeTruthy();
    expect(errors.social).toBeTruthy();
    expect(errors.attested).toBeTruthy();
  });

  it('accepts either instagram or website for social verification', () => {
    const withWebsite = validateVendorApplicationFields(
      validInput({ instagram_url: null, website_url: 'https://riverfarm.test' }),
      true,
    );
    expect(withWebsite.social).toBeUndefined();
  });
});

describe('validateVendorApplication', () => {
  it('returns the first validation error message', () => {
    expect(
      validateVendorApplication(validInput({ business_name: '' }), true),
    ).toMatch(/Business name/);
  });

  it('returns null when the application is valid', () => {
    expect(validateVendorApplication(validInput(), true)).toBeNull();
  });
});

describe('isVendorApplicationComplete', () => {
  it('returns false for null or incomplete vendors', () => {
    expect(isVendorApplicationComplete(null)).toBe(false);
    expect(isVendorApplicationComplete(undefined)).toBe(false);
    expect(
      isVendorApplicationComplete({ application_submitted_at: null, business_name: 'Farm' } as never),
    ).toBe(false);
    expect(
      isVendorApplicationComplete({
        application_submitted_at: '2026-01-01T00:00:00.000Z',
        business_name: '  ',
      } as never),
    ).toBe(false);
  });

  it('returns true when submitted with a business name', () => {
    expect(
      isVendorApplicationComplete({
        application_submitted_at: '2026-01-01T00:00:00.000Z',
        business_name: 'River Farm',
      } as never),
    ).toBe(true);
  });
});
