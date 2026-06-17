import { resolvePosLineItemName } from '../src/modules/pos/utils/pos-line-item.util';

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
});
