import {
  mapSquareOrderToTransaction,
  mapSquarePaymentToTransaction,
  toCents,
} from './square-analytics.mapper';

const ctx = {
  vendorId: 'vendor-1',
  posConnectionId: 'conn-1',
  provider: 'square' as const,
};

describe('toCents', () => {
  it('passes through Square integer cents', () => {
    expect(toCents(1250)).toBe(1250);
    expect(toCents({ amount: 99 })).toBe(99);
  });

  it('converts decimal dollar strings', () => {
    expect(toCents('12.34')).toBe(1234);
  });

  it('guards invalid values', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents('nope')).toBe(0);
  });
});

describe('mapSquareOrderToTransaction', () => {
  it('maps order + line items into unified cents', () => {
    const txn = mapSquareOrderToTransaction(
      {
        id: 'order-abc',
        location_id: 'LOC1',
        state: 'COMPLETED',
        closed_at: '2026-07-15T12:00:00Z',
        total_money: { amount: 1100, currency: 'USD' },
        total_tax_money: { amount: 80 },
        tenders: [{ tip_money: { amount: 200 } }],
        line_items: [
          {
            uid: 'li-1',
            name: 'Sourdough',
            quantity: '2',
            catalog_object_id: 'CAT1',
            base_price_money: { amount: 400 },
            gross_sales_money: { amount: 800 },
          },
        ],
      },
      ctx,
    );

    expect(txn).toMatchObject({
      externalTransactionId: 'order-abc',
      vendorId: 'vendor-1',
      posConnectionId: 'conn-1',
      provider: 'square',
      totalAmountCents: 1100,
      taxAmountCents: 80,
      tipAmountCents: 200,
      paymentStatus: 'completed',
      providerLocationId: 'LOC1',
    });
    expect(txn?.items).toHaveLength(1);
    expect(txn?.items[0]).toMatchObject({
      externalItemId: 'li-1',
      name: 'Sourdough',
      quantity: 2,
      unitPriceCents: 400,
      totalPriceCents: 800,
      providerCatalogId: 'CAT1',
    });
  });

  it('marks refunded orders', () => {
    const txn = mapSquareOrderToTransaction(
      {
        id: 'order-r',
        state: 'COMPLETED',
        total_money: { amount: 500, currency: 'USD' },
        refunded_money: { amount: 500 },
        line_items: [],
      },
      ctx,
    );
    expect(txn?.paymentStatus).toBe('refunded');
  });
});

describe('mapSquarePaymentToTransaction', () => {
  it('prefers payment id and tip from payment payload', () => {
    const txn = mapSquarePaymentToTransaction(
      {
        id: 'payment-1',
        status: 'COMPLETED',
        created_at: '2026-07-15T13:00:00Z',
        total_money: { amount: 1500, currency: 'USD' },
        tip_money: { amount: 300 },
        tax_money: { amount: 100 },
        location_id: 'LOC2',
      },
      ctx,
      {
        id: 'order-xyz',
        location_id: 'LOC2',
        state: 'COMPLETED',
        total_money: { amount: 1500, currency: 'USD' },
        line_items: [
          {
            uid: 'li-9',
            name: 'Latte',
            quantity: '1',
            base_price_money: { amount: 1200 },
            gross_sales_money: { amount: 1200 },
          },
        ],
      },
    );

    expect(txn?.externalTransactionId).toBe('payment-1');
    expect(txn?.tipAmountCents).toBe(300);
    expect(txn?.taxAmountCents).toBe(100);
    expect(txn?.items[0]?.name).toBe('Latte');
  });
});
