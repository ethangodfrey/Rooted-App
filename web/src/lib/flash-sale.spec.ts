import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FLASH_DISCOUNT_PERCENT,
  applyFlashDiscount,
  flashSaleBadgeText,
  isLowWalkUpStock,
  mergeFlashSaleIntoTheme,
  parseFlashSale,
} from './flash-sale';

describe('applyFlashDiscount', () => {
  it('applies percentage discounts to cent prices', () => {
    expect(applyFlashDiscount(1000, 15)).toBe(850);
    expect(applyFlashDiscount(999, 10)).toBe(899);
  });

  it('returns the original rounded price for zero percent discount', () => {
    expect(applyFlashDiscount(1250, 0)).toBe(1250);
  });

  it('clamps discount percent between 0 and 90', () => {
    expect(applyFlashDiscount(1000, 95)).toBe(100);
    expect(applyFlashDiscount(1000, -5)).toBe(1000);
  });

  it('handles non-finite price or discount inputs safely', () => {
    expect(applyFlashDiscount(Number.NaN, 15)).toBe(0);
    expect(applyFlashDiscount(500, Number.NaN)).toBe(500);
    expect(applyFlashDiscount(Number.POSITIVE_INFINITY, 20)).toBe(0);
  });

  it('never returns negative discounted prices', () => {
    expect(applyFlashDiscount(0, 50)).toBe(0);
    expect(applyFlashDiscount(-100, 50)).toBe(0);
  });
});

describe('flashSaleBadgeText', () => {
  it('formats remaining units with a non-negative floor', () => {
    expect(flashSaleBadgeText(3)).toBe('ONLY 3 LEFT - FLASH SALE ACTIVE');
    expect(flashSaleBadgeText(3.9)).toBe('ONLY 3 LEFT - FLASH SALE ACTIVE');
    expect(flashSaleBadgeText(-2)).toBe('ONLY 0 LEFT - FLASH SALE ACTIVE');
  });
});

describe('parseFlashSale', () => {
  it('returns null for empty, invalid, or inactive payloads', () => {
    expect(parseFlashSale(null)).toBeNull();
    expect(parseFlashSale(undefined)).toBeNull();
    expect(parseFlashSale({})).toBeNull();
    expect(parseFlashSale({ flash_sale: { active: false, productId: 'p1' } })).toBeNull();
    expect(parseFlashSale({ flash_sale: { active: true } })).toBeNull();
    expect(parseFlashSale({ flash_sale: { active: true, productId: '' } })).toBeNull();
  });

  it('parses active flash sale state with defaults', () => {
    const parsed = parseFlashSale({
      flash_sale: {
        active: true,
        productId: 'prod-1',
        unitsLeft: '4.8',
        discountPercent: '120',
      },
    });

    expect(parsed).toMatchObject({
      active: true,
      productId: 'prod-1',
      productName: 'Featured item',
      unitsLeft: 4,
      discountPercent: 90,
    });
    expect(parsed?.activatedAt).toEqual(expect.any(String));
  });

  it('preserves known product metadata when provided', () => {
    const parsed = parseFlashSale({
      flash_sale: {
        active: true,
        productId: 'prod-2',
        productName: 'Honey Jar',
        unitsLeft: 2,
        discountPercent: 20,
        activatedAt: '2026-07-10T12:00:00.000Z',
      },
    });

    expect(parsed).toEqual({
      active: true,
      productId: 'prod-2',
      productName: 'Honey Jar',
      unitsLeft: 2,
      discountPercent: 20,
      activatedAt: '2026-07-10T12:00:00.000Z',
    });
  });

  it('falls back to the default discount percent for invalid values', () => {
    const parsed = parseFlashSale({
      flash_sale: {
        active: true,
        productId: 'prod-3',
        discountPercent: 'not-a-number',
      },
    });

    expect(parsed?.discountPercent).toBe(DEFAULT_FLASH_DISCOUNT_PERCENT);
  });
});

describe('mergeFlashSaleIntoTheme', () => {
  it('merges flash sale data into existing theme settings', () => {
    const flash = {
      active: true,
      productId: 'prod-1',
      productName: 'Eggs',
      unitsLeft: 2,
      discountPercent: 15,
      activatedAt: '2026-07-10T12:00:00.000Z',
    };

    const merged = mergeFlashSaleIntoTheme({ accent: 'green' }, flash);

    expect(merged).toMatchObject({
      accent: 'green',
      featured_highlight: 'ONLY 2 LEFT - FLASH SALE ACTIVE',
      flash_sale: flash,
    });
  });

  it('creates a fresh theme object when existing settings are missing', () => {
    const flash = {
      active: true,
      productId: 'prod-1',
      productName: 'Eggs',
      unitsLeft: 1,
      discountPercent: 10,
      activatedAt: '2026-07-10T12:00:00.000Z',
    };

    const merged = mergeFlashSaleIntoTheme(undefined, flash);
    expect(merged.featured_highlight).toBe('ONLY 1 LEFT - FLASH SALE ACTIVE');
  });
});

describe('isLowWalkUpStock', () => {
  it('detects stock below the default threshold', () => {
    expect(isLowWalkUpStock(0)).toBe(true);
    expect(isLowWalkUpStock(4)).toBe(true);
    expect(isLowWalkUpStock(5)).toBe(false);
  });

  it('supports custom thresholds and rejects invalid unit counts', () => {
    expect(isLowWalkUpStock(2, 3)).toBe(true);
    expect(isLowWalkUpStock(3, 3)).toBe(false);
    expect(isLowWalkUpStock(Number.NaN)).toBe(false);
    expect(isLowWalkUpStock(-1)).toBe(false);
  });
});
