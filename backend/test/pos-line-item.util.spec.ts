import { formatUsd, resolvePosLineItemName } from '../src/modules/pos/utils/pos-line-item.util';

describe('formatUsd', () => {
  it('formats cents as USD with two decimal places', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(99)).toBe('$0.99');
    expect(formatUsd(1200)).toBe('$12.00');
  });
});

describe('resolvePosLineItemName', () => {
  it('labels Square CUSTOM_AMOUNT lines with the sale amount', () => {
    expect(
      resolvePosLineItemName('Item', 1200, {
        item_type: 'CUSTOM_AMOUNT',
        gross_sales_money: { amount: 1200 },
      }),
    ).toBe('Quick sale · $12.00');
  });

  it('keeps catalog item names when present', () => {
    expect(resolvePosLineItemName('Sourdough Loaf', 600, { item_type: 'ITEM' })).toBe(
      'Sourdough Loaf',
    );
  });

  it('falls back to a generic sale label for empty names', () => {
    expect(resolvePosLineItemName('', 500)).toBe('Sale · $5.00');
    expect(resolvePosLineItemName(undefined, 0)).toBe('Register item');
  });

  it('uses catalog metadata when the provider name is generic', () => {
    expect(
      resolvePosLineItemName('Item', 800, {
        item_type: 'ITEM',
        name: 'Heirloom Tomato',
      }),
    ).toBe('Heirloom Tomato');
  });
});
