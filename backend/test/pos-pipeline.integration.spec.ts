import type { PosConnection } from '@prisma/client';

import { PosAnalyticsService } from '../src/modules/pos/services/pos-analytics.service';
import { PosImportService } from '../src/modules/pos/services/pos-import.service';
import { PosMappingService } from '../src/modules/pos/services/pos-mapping.service';
import type { NormalizedTransaction } from '../src/modules/pos/types/normalized-transaction';
import { createFakePrisma, type FakePrisma } from './fake-prisma';

const VENDOR_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';
const CONNECTION_ID = '33333333-3333-3333-3333-333333333333';
const SYNC_RUN_ID = '44444444-4444-4444-4444-444444444444';

function connection(): PosConnection {
  return {
    id: CONNECTION_ID,
    vendorId: VENDOR_ID,
    provider: 'SQUARE',
    providerLocationId: null,
  } as unknown as PosConnection;
}

function txn(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    providerTransactionId: 'sq-order-1',
    providerOrderId: 'sq-order-1',
    providerLocationId: 'L1',
    state: 'COMPLETED',
    soldAt: '2026-06-08T15:30:00.000Z',
    currency: 'USD',
    grossAmount: 1200,
    discountAmount: 0,
    taxAmount: 100,
    tipAmount: 200,
    netAmount: 1500,
    tenderType: 'CARD',
    cardBrand: 'VISA',
    lineItems: [
      {
        providerLineItemId: 'li-1',
        providerCatalogObjectId: 'cat-abc',
        name: 'Sourdough Loaf',
        quantity: 2,
        unitPrice: 600,
        grossAmount: 1200,
      },
    ],
    raw: { id: 'sq-order-1' },
    ...overrides,
  };
}

function buildPipeline(fake: FakePrisma) {
  const mapping = new PosMappingService(fake.prisma);
  const analytics = new PosAnalyticsService(fake.prisma);
  const importer = new PosImportService(fake.prisma, mapping, analytics);
  return { mapping, analytics, importer };
}

describe('POS import → mapping → analytics pipeline', () => {
  let fake: FakePrisma;

  beforeEach(() => {
    fake = createFakePrisma({
      products: [{ id: PRODUCT_ID, vendorId: VENDOR_ID, name: 'Sourdough Loaf', price: 600 }],
    });
  });

  it('imports a new transaction, auto-matches the product, and bridges inventory', async () => {
    const { importer } = buildPipeline(fake);

    const result = await importer.importTransactions(connection(), SYNC_RUN_ID, [txn()]);

    expect(result).toMatchObject({ imported: 1, skipped: 0, updated: 0 });
    expect(result.affectedDates).toEqual(['2026-06-08']);

    // Transaction + line item persisted.
    expect(fake.store.transactions).toHaveLength(1);
    expect(fake.store.lineItems).toHaveLength(1);

    // Auto-matched mapping created and linked to the Rooted product.
    expect(fake.store.productMappings).toHaveLength(1);
    expect(fake.store.productMappings[0]).toMatchObject({
      providerCatalogObjectId: 'cat-abc',
      productId: PRODUCT_ID,
      autoMatched: true,
    });

    // Inventory bridge: one negative sale_pos transaction, line item linked.
    expect(fake.store.inventoryTransactions).toHaveLength(1);
    expect(fake.store.inventoryTransactions[0]).toMatchObject({
      vendorId: VENDOR_ID,
      productId: PRODUCT_ID,
      transactionType: 'sale_pos',
      quantityChange: -2,
      source: 'pos:square:sq-order-1',
    });
    expect(fake.store.lineItems[0].inventoryTransactionId).toBeTruthy();
  });

  it('is idempotent: re-importing the same transaction skips and does not double-count', async () => {
    const { importer } = buildPipeline(fake);

    await importer.importTransactions(connection(), SYNC_RUN_ID, [txn()]);
    const second = await importer.importTransactions(connection(), SYNC_RUN_ID, [txn()]);

    expect(second).toMatchObject({ imported: 0, skipped: 1, updated: 0 });
    expect(fake.store.transactions).toHaveLength(1);
    expect(fake.store.lineItems).toHaveLength(1);
    expect(fake.store.inventoryTransactions).toHaveLength(1);
  });

  it('updates state when a previously imported transaction is refunded', async () => {
    const { importer } = buildPipeline(fake);

    await importer.importTransactions(connection(), SYNC_RUN_ID, [txn()]);
    const refunded = await importer.importTransactions(connection(), SYNC_RUN_ID, [
      txn({ state: 'REFUNDED' }),
    ]);

    expect(refunded).toMatchObject({ imported: 0, skipped: 0, updated: 1 });
    expect(fake.store.transactions[0].state).toBe('REFUNDED');
  });

  it('imports unmatched items without a product link (mapping stub, no inventory)', async () => {
    const { importer } = buildPipeline(fake);

    const unmatched = txn({
      providerTransactionId: 'sq-order-2',
      lineItems: [
        {
          providerLineItemId: 'li-9',
          providerCatalogObjectId: 'cat-unknown',
          name: 'Mystery Item',
          quantity: 1,
          unitPrice: 500,
          grossAmount: 500,
        },
      ],
    });

    const result = await importer.importTransactions(connection(), SYNC_RUN_ID, [unmatched]);

    expect(result.imported).toBe(1);
    // Mapping stub created but unresolved; no inventory written.
    const mapping = fake.store.productMappings.find(
      (m) => m.providerCatalogObjectId === 'cat-unknown',
    );
    expect(mapping).toMatchObject({ productId: null, autoMatched: false });
    expect(fake.store.inventoryTransactions).toHaveLength(0);
  });

  it('inventory sync is idempotent when called repeatedly', async () => {
    const { importer, analytics } = buildPipeline(fake);
    await importer.importTransactions(connection(), SYNC_RUN_ID, [txn()]);

    const importedTxnId = fake.store.transactions[0].id;
    await analytics.syncInventoryForTransaction(importedTxnId);
    await analytics.syncInventoryForTransaction(importedTxnId);

    expect(fake.store.inventoryTransactions).toHaveLength(1);
  });

  it('recomputes analytics snapshots from imported POS revenue/units', async () => {
    const { importer, analytics } = buildPipeline(fake);
    await importer.importTransactions(connection(), SYNC_RUN_ID, [txn()]);

    await analytics.recomputeSnapshots(VENDOR_ID, ['2026-06-08']);

    expect(fake.store.snapshots).toHaveLength(1);
    expect(fake.store.snapshots[0]).toMatchObject({
      vendorId: VENDOR_ID,
      revenueTotal: 1500,
      inpersonSales: 2,
      ordersTotal: 1,
    });
  });
});
