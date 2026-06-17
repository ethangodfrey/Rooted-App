import type { ConfigService } from '@nestjs/config';
import type { PosConnection } from '@prisma/client';

import { SquareAdapter } from '../src/modules/pos/adapters/square/square.adapter';
import { PosAnalyticsService } from '../src/modules/pos/services/pos-analytics.service';
import { PosImportService } from '../src/modules/pos/services/pos-import.service';
import { PosMappingService } from '../src/modules/pos/services/pos-mapping.service';
import { createFakePrisma } from './fake-prisma';

const VENDOR_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';
const CONNECTION_ID = '33333333-3333-3333-3333-333333333333';
const SYNC_RUN_ID = '44444444-4444-4444-4444-444444444444';

const CONFIG: Record<string, string> = {
  SQUARE_ENVIRONMENT: 'sandbox',
  SQUARE_APPLICATION_ID: 'app-id',
  SQUARE_APPLICATION_SECRET: 'app-secret',
  PUBLIC_BASE_URL: 'https://api.test',
};

function fakeConfig(): ConfigService {
  return { get: (k: string, def?: string) => (k in CONFIG ? CONFIG[k] : def) } as unknown as ConfigService;
}

function connection(): PosConnection {
  return {
    id: CONNECTION_ID,
    vendorId: VENDOR_ID,
    provider: 'SQUARE',
    providerLocationId: null,
  } as unknown as PosConnection;
}

// A realistic-ish Square Orders Search payload for one completed card sale.
const SQUARE_ORDER = {
  id: 'sqOrder1',
  location_id: 'L1',
  state: 'COMPLETED',
  closed_at: '2026-06-08T15:30:00.000Z',
  created_at: '2026-06-08T15:29:00.000Z',
  total_money: { amount: 1500, currency: 'USD' },
  total_tax_money: { amount: 100 },
  total_discount_money: { amount: 0 },
  net_amounts: { total_money: { amount: 1500, currency: 'USD' } },
  refunded_money: { amount: 0 },
  line_items: [
    {
      uid: 'li1',
      catalog_object_id: 'cat-abc',
      name: 'Sourdough Loaf',
      quantity: '2',
      base_price_money: { amount: 600 },
      gross_sales_money: { amount: 1200 },
      total_money: { amount: 1320 },
      total_tax_money: { amount: 120 },
    },
  ],
  tenders: [
    { type: 'CARD', tip_money: { amount: 200 }, card_details: { card: { card_brand: 'VISA' } } },
  ],
};

describe('Square connect → sync → import → analytics (smoke)', () => {
  it('exchanges OAuth, searches orders, normalizes, imports, and rolls up analytics', async () => {
    const adapter = new SquareAdapter(fakeConfig());
    const http = (adapter as unknown as { http: { get: jest.Mock; post: jest.Mock } }).http;

    jest.spyOn(http, 'get').mockResolvedValue({
      data: { locations: [{ id: 'L1', name: 'Main' }] },
    } as never);
    jest.spyOn(http, 'post').mockImplementation((url: string) => {
      if (url.includes('/oauth2/token')) {
        return Promise.resolve({
          data: {
            access_token: 'access-tok',
            refresh_token: 'refresh-tok',
            expires_at: '2026-12-31T00:00:00Z',
            merchant_id: 'M1',
          },
        }) as never;
      }
      if (url.includes('/v2/orders/search')) {
        return Promise.resolve({ data: { orders: [SQUARE_ORDER], cursor: null } }) as never;
      }
      return Promise.resolve({ data: {} }) as never;
    });

    // 1. Connect: exchange the OAuth authorization code for tokens.
    const token = await adapter.exchangeOAuthCode('auth-code', 'https://api.test/cb');
    expect(token).toMatchObject({
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
      merchantId: 'M1',
    });

    // 2. Sync: fetch + normalize Square orders (location auto-resolved).
    const page = await adapter.fetchTransactions({
      credentials: { accessToken: token.accessToken },
      since: '2026-06-01T00:00:00Z',
      until: '2026-06-09T00:00:00Z',
    });
    expect(page.nextCursor).toBeNull();
    expect(page.transactions).toHaveLength(1);
    const normalized = page.transactions[0];
    expect(normalized).toMatchObject({
      providerTransactionId: 'sqOrder1',
      providerLocationId: 'L1',
      state: 'COMPLETED',
      grossAmount: 1500,
      netAmount: 1500,
      tipAmount: 200,
      tenderType: 'CARD',
      cardBrand: 'VISA',
    });
    expect(normalized.lineItems[0]).toMatchObject({
      providerCatalogObjectId: 'cat-abc',
      name: 'Sourdough Loaf',
      quantity: 2,
    });

    // 3. Import into the real pipeline backed by an in-memory Prisma.
    const fake = createFakePrisma({
      products: [{ id: PRODUCT_ID, vendorId: VENDOR_ID, name: 'Sourdough Loaf', price: 600 }],
    });
    const mapping = new PosMappingService(fake.prisma);
    const analytics = new PosAnalyticsService(fake.prisma);
    const importer = new PosImportService(fake.prisma, mapping, analytics);

    const result = await importer.importTransactions(connection(), SYNC_RUN_ID, page.transactions);
    expect(result).toMatchObject({ imported: 1, skipped: 0, updated: 0 });

    // Inventory bridged for the auto-matched product.
    expect(fake.store.inventoryTransactions).toHaveLength(1);
    expect(fake.store.inventoryTransactions[0]).toMatchObject({
      vendorId: VENDOR_ID,
      productId: PRODUCT_ID,
      transactionType: 'sale_pos',
      quantityChange: -2,
    });

    // 4. Analytics rollup reflects the card sale's net revenue + units.
    await analytics.recomputeSnapshots(VENDOR_ID, [...result.affectedDates]);
    expect(fake.store.snapshots[0]).toMatchObject({
      vendorId: VENDOR_ID,
      revenueTotal: 1500,
      inpersonSales: 2,
      ordersTotal: 1,
    });
  });
});
