import { formatUsd, resolvePosLineItemName } from './pos-line-item.util';

describe('formatUsd', () => {
  it('formats whole-dollar amounts', () => {
    expect(formatUsd(1200)).toBe('$12.00');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('formats fractional cents', () => {
    expect(formatUsd(99)).toBe('$0.99');
    expect(formatUsd(1)).toBe('$0.01');
  });

  it('handles negative amounts', () => {
    expect(formatUsd(-500)).toBe('$-5.00');
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

  it('falls back to catalog name from raw payload when name is generic', () => {
    expect(
      resolvePosLineItemName('Item', 600, {
        item_type: 'ITEM',
        name: 'Heirloom Tomato',
      }),
    ).toBe('Heirloom Tomato');
  });

  it('uses variation_name when name is missing', () => {
    expect(
      resolvePosLineItemName('Register item', 450, {
        item_type: 'ITEM',
        variation_name: 'Small Latte',
      }),
    ).toBe('Small Latte');
  });

  it('returns trimmed non-generic names', () => {
    expect(resolvePosLineItemName('  Honey Jar  ', 800)).toBe('Honey Jar');
  });

  it('labels unnamed positive-amount lines as a sale', () => {
    expect(resolvePosLineItemName('', 750)).toBe('Sale · $7.50');
    expect(resolvePosLineItemName(undefined, 250)).toBe('Sale · $2.50');
  });

  it('returns Register item for zero-amount unnamed lines', () => {
    expect(resolvePosLineItemName('', 0)).toBe('Register item');
    expect(resolvePosLineItemName(null, 0)).toBe('Register item');
  });

  it('ignores non-object raw payloads', () => {
    expect(resolvePosLineItemName('Item', 500, 'not-an-object')).toBe('Item');
    expect(resolvePosLineItemName(null, 500, null)).toBe('Sale · $5.00');
  });
});
