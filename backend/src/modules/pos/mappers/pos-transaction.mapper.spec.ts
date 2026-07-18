import type { PosImportedLineItem, PosImportedTransaction, Product } from '@prisma/client';

import { mapImportedTransactionForApi } from './pos-transaction.mapper';

type LineItemWithProduct = PosImportedLineItem & {
  product: Pick<Product, 'id' | 'name'> | null;
};

type TransactionWithLines = PosImportedTransaction & {
  lineItems: LineItemWithProduct[];
};

function txn(overrides: Partial<TransactionWithLines> = {}): TransactionWithLines {
  return {
    id: 'txn-1',
    soldAt: new Date('2026-06-08T15:30:00.000Z'),
    currency: 'USD',
    grossAmount: 1200,
    netAmount: 1500,
    state: 'COMPLETED',
    tenderType: 'CARD',
    cardBrand: 'VISA',
    rawPayload: null,
    lineItems: [],
    ...overrides,
  } as TransactionWithLines;
}

describe('mapImportedTransactionForApi', () => {
  it('maps stored line items with resolved names', () => {
    const result = mapImportedTransactionForApi(
      txn({
        lineItems: [
          {
            id: 'li-1',
            name: 'Eggs',
            quantity: 2,
            grossAmount: 1200,
            productId: 'prod-1',
            product: { id: 'prod-1', name: 'Farm Eggs' },
            rawPayload: { item_type: 'ITEM' },
          } as unknown as LineItemWithProduct,
        ],
      }),
    );

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({
      id: 'li-1',
      name: 'Eggs',
      quantity: 2,
      grossAmount: 1200,
      productId: 'prod-1',
      itemType: 'ITEM',
    });
  });

  it('falls back to Square raw payload line items when stored lines are empty', () => {
    const result = mapImportedTransactionForApi(
      txn({
        lineItems: [],
        rawPayload: {
          line_items: [
            {
              name: 'Jam',
              quantity: '1',
              gross_sales_money: { amount: 900 },
              item_type: 'ITEM',
            },
          ],
        },
      }),
    );

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({
      name: 'Jam',
      quantity: 1,
      grossAmount: 900,
      itemType: 'ITEM',
    });
  });

  it('uses a synthetic fallback line item for positive net amounts with no lines', () => {
    const result = mapImportedTransactionForApi(
      txn({
        netAmount: 875,
        lineItems: [],
        rawPayload: null,
      }),
    );

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({
      name: 'Card sale · $8.75',
      quantity: 1,
      grossAmount: 875,
    });
  });

  it('returns no fallback line items when net amount is zero', () => {
    const result = mapImportedTransactionForApi(
      txn({
        netAmount: 0,
        lineItems: [],
        rawPayload: null,
      }),
    );

    expect(result.lineItems).toEqual([]);
  });

  it('ignores malformed Square raw payloads', () => {
    const result = mapImportedTransactionForApi(
      txn({
        netAmount: 0,
        lineItems: [],
        rawPayload: 'not-an-object',
      }),
    );

    expect(result.lineItems).toEqual([]);
  });
});
