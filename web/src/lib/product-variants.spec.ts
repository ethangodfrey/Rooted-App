import { describe, expect, it, vi } from 'vitest';

import {
  combinationLabel,
  emptyVariantsPayload,
  parseVariants,
  regenerateCombinations,
  type ProductVariantsPayload,
  type VariantAttribute,
  type VariantCombination,
} from './product-variants';

describe('emptyVariantsPayload', () => {
  it('returns empty attributes and combinations arrays', () => {
    expect(emptyVariantsPayload()).toEqual({ attributes: [], combinations: [] });
  });
});

describe('parseVariants', () => {
  it('returns empty payload for null, undefined, and non-objects', () => {
    expect(parseVariants(null)).toEqual(emptyVariantsPayload());
    expect(parseVariants(undefined)).toEqual(emptyVariantsPayload());
    expect(parseVariants('not-json')).toEqual(emptyVariantsPayload());
    expect(parseVariants(42)).toEqual(emptyVariantsPayload());
  });

  it('filters invalid attributes and combinations', () => {
    const raw = {
      attributes: [
        { name: 'Size', values: ['S', 'M'] },
        { name: '', values: ['X'] },
        { values: ['bad'] },
        null,
      ],
      combinations: [
        { id: 'c1', options: { Size: 'S' }, price_cents: 500, stock: 3 },
        { id: 'c2', options: { Size: 'M' } },
        { options: { Size: 'L' }, price_cents: 600 },
        null,
      ],
    };

    const parsed = parseVariants(raw);
    expect(parsed.attributes.filter((a) => a.name === 'Size')).toHaveLength(1);
    expect(parsed.attributes[0]).toEqual({ name: 'Size', values: ['S', 'M'] });
    expect(parsed.combinations).toHaveLength(1);
    expect(parsed.combinations[0]).toMatchObject({
      id: 'c1',
      price_cents: 500,
      stock: 3,
    });
  });

  it('returns empty arrays when attributes or combinations are missing', () => {
    expect(parseVariants({})).toEqual(emptyVariantsPayload());
    expect(parseVariants({ attributes: 'bad', combinations: 123 })).toEqual(
      emptyVariantsPayload(),
    );
  });
});

describe('combinationLabel', () => {
  it('joins option key-value pairs into a readable label', () => {
    const combo: VariantCombination = {
      id: 'c1',
      options: { Size: 'M', Color: 'Black' },
      price_cents: 1200,
      stock: 5,
    };

    expect(combinationLabel(combo)).toBe('Size: M, Color: Black');
  });

  it('returns an empty string when options are empty', () => {
    const combo: VariantCombination = {
      id: 'c-empty',
      options: {},
      price_cents: 0,
      stock: 0,
    };

    expect(combinationLabel(combo)).toBe('');
  });
});

describe('regenerateCombinations', () => {
  it('builds the cartesian product of attribute values', () => {
    const attributes: VariantAttribute[] = [
      { name: 'Size', values: ['S', 'M'] },
      { name: 'Color', values: ['Red', 'Blue'] },
    ];

    const combos = regenerateCombinations(attributes, [], 999);

    expect(combos).toHaveLength(4);
    const labels = combos.map(combinationLabel).sort();
    expect(labels).toEqual([
      'Size: M, Color: Blue',
      'Size: M, Color: Red',
      'Size: S, Color: Blue',
      'Size: S, Color: Red',
    ]);
    for (const combo of combos) {
      expect(combo.price_cents).toBe(999);
      expect(combo.stock).toBe(0);
    }
  });

  it('preserves price, stock, sku, and id for matching option sets', () => {
    const attributes: VariantAttribute[] = [{ name: 'Size', values: ['S', 'M'] }];
    const previous: VariantCombination[] = [
      {
        id: 'keep-s',
        options: { Size: 'S' },
        price_cents: 800,
        stock: 12,
        sku: 'SKU-S',
      },
    ];

    const combos = regenerateCombinations(attributes, previous, 500);
    const small = combos.find((c) => c.options.Size === 'S');
    const medium = combos.find((c) => c.options.Size === 'M');

    expect(small).toMatchObject({
      id: 'keep-s',
      price_cents: 800,
      stock: 12,
      sku: 'SKU-S',
    });
    expect(medium).toMatchObject({
      price_cents: 500,
      stock: 0,
      sku: null,
    });
    expect(medium?.id).toBeTruthy();
    expect(medium?.id).not.toBe('keep-s');
  });

  it('ignores attributes with blank names or empty value lists', () => {
    const attributes: VariantAttribute[] = [
      { name: '  ', values: ['A'] },
      { name: 'Size', values: ['', '  '] },
      { name: 'Weight', values: ['1 lb'] },
    ];

    expect(regenerateCombinations(attributes, [], 100)).toEqual([
      expect.objectContaining({
        options: { Weight: '1 lb' },
        price_cents: 100,
      }),
    ]);
  });

  it('returns an empty list when no usable attributes remain', () => {
    expect(regenerateCombinations([], [], 100)).toEqual([]);
    expect(
      regenerateCombinations([{ name: 'Size', values: ['', '  '] }], [], 100),
    ).toEqual([]);
  });

  it('assigns stable ids via crypto.randomUUID for new combinations', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'generated-id' });

    const combos = regenerateCombinations(
      [{ name: 'Size', values: ['L'] }],
      [],
      750,
    );

    expect(combos[0]?.id).toBe('generated-id');

    vi.unstubAllGlobals();
  });
});
