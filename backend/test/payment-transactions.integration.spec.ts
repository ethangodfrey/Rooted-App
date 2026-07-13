import { createHmac } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import type { PosConnection } from '@prisma/client';

import { SquareAdapter } from '../src/modules/pos/adapters/square/square.adapter';
import { PosAnalyticsService } from '../src/modules/pos/services/pos-analytics.service';
import { PosImportService } from '../src/modules/pos/services/pos-import.service';
import { PosMappingService } from '../src/modules/pos/services/pos-mapping.service';
import { PosWebhookService } from '../src/modules/pos/services/pos-webhook.service';
import type { NormalizedTransaction } from '../src/modules/pos/types/normalized-transaction';
import type { CheckoutInventoryService } from '../src/modules/checkout/checkout-inventory.service';
import { StripeService } from '../src/modules/stripe/stripe.service';
import { createFakeOrderPrisma } from './fake-order-prisma';
import { createFakePrisma } from './fake-prisma';

const mockCheckoutSessionsCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    webhooks: { constructEvent: jest.fn() },
    accounts: { create: jest.fn(), retrieve: jest.fn() },
    accountLinks: { create: jest.fn() },
  }));
});

function fakeInventory(): CheckoutInventoryService {
  return {
    finalizePaidOrder: jest.fn(async () => undefined),
    compensateStripeCheckout: jest.fn(async () => undefined),
    reserveForStripeCheckout: jest.fn(async () => undefined),
    decrementPresale: jest.fn(async () => undefined),
  } as unknown as CheckoutInventoryService;
}

const SQUARE_CONFIG: Record<string, string> = {
  SQUARE_ENVIRONMENT: 'sandbox',
  SQUARE_APPLICATION_ID: 'app-id',
  SQUARE_APPLICATION_SECRET: 'app-secret',
  SQUARE_ACCESS_TOKEN: 'sandbox-app-access-token',
  PUBLIC_BASE_URL: 'https://api.test',
  SQUARE_WEBHOOK_SIGNATURE_KEY: 'sig-key',
};

const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const VENDOR_ID = '11111111-1111-1111-1111-111111111111';
const CONNECTION_ID = '33333333-3333-3333-3333-333333333333';
const SYNC_RUN_ID = '44444444-4444-4444-4444-444444444444';

function stripeConfig(): ConfigService {
  return {
    get: (key: string, def?: string) =>
      ({
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        WEB_APP_URL: 'https://app.vendorly.test',
      })[key] ?? def,
  } as unknown as ConfigService;
}

function squareConfig(): ConfigService {
  return {
    get: (key: string, def?: string) => (key in SQUARE_CONFIG ? SQUARE_CONFIG[key] : def),
  } as unknown as ConfigService;
}

function stripeOrder() {
  return {
    id: ORDER_ID,
    total: 1800,
    payment_status: 'unpaid',
    stripe_checkout_session_id: null as string | null,
    stripe_payment_intent_id: null as string | null,
    vendor_id: VENDOR_ID,
    business_name: 'River Farm',
    stripe_account_id: 'acct_vendor',
    stripe_charges_enabled: true,
    customer_user_id: CUSTOMER_ID,
  };
}

function squareConnection(): PosConnection {
  return {
    id: CONNECTION_ID,
    vendorId: VENDOR_ID,
    provider: 'SQUARE',
    providerLocationId: 'L1',
    providerMerchantId: 'M1',
    status: 'ACTIVE',
    webhookSecret: null,
  } as unknown as PosConnection;
}

function squareTxn(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
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
    raw: { id: 'sq-order-1', state: 'COMPLETED' },
    ...overrides,
  };
}

describe('dual payment transaction processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_dual',
      url: 'https://checkout.stripe.test/cs_test_dual',
    });
  });

  describe('Stripe checkout → webhook success', () => {
    it('moves an order from unpaid to stripe_pending to paid_online', async () => {
      const fake = createFakeOrderPrisma([stripeOrder()]);
      const inventory = fakeInventory();
      const stripe = new StripeService(stripeConfig(), fake.prisma, inventory);

      await stripe.createOrderCheckoutSession({
        orderId: ORDER_ID,
        customerUserId: CUSTOMER_ID,
      });
      expect(fake.orders[0].payment_status).toBe('stripe_pending');

      await stripe.handleWebhookEvent({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_dual',
            metadata: { order_id: ORDER_ID, customer_user_id: CUSTOMER_ID },
            payment_intent: 'pi_success',
          },
        },
      } as never);

      expect(fake.orders[0]).toMatchObject({
        payment_status: 'paid_online',
        stripe_payment_intent_id: 'pi_success',
      });
      expect(inventory.finalizePaidOrder).toHaveBeenCalledWith(expect.anything(), ORDER_ID, CUSTOMER_ID);
    });

    it('compensates inventory when checkout.session.expired fires for a pending order', async () => {
      const fake = createFakeOrderPrisma([
        {
          ...stripeOrder(),
          payment_status: 'stripe_pending',
          stripe_checkout_session_id: 'cs_test_dual',
        },
      ]);
      const inventory = fakeInventory();
      const stripe = new StripeService(stripeConfig(), fake.prisma, inventory);

      await stripe.handleWebhookEvent({
        id: 'evt_expired',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_test_dual',
            metadata: { order_id: ORDER_ID, customer_user_id: CUSTOMER_ID },
          },
        },
      } as never);

      expect(fake.orders[0].payment_status).toBe('stripe_pending');
      expect(inventory.compensateStripeCheckout).toHaveBeenCalledWith(
        expect.anything(),
        ORDER_ID,
        CUSTOMER_ID,
      );
      expect(inventory.finalizePaidOrder).not.toHaveBeenCalled();
    });

    it('does not compensate when expired webhook lacks order metadata', async () => {
      const fake = createFakeOrderPrisma([
        {
          ...stripeOrder(),
          payment_status: 'stripe_pending',
          stripe_checkout_session_id: 'cs_test_dual',
        },
      ]);
      const inventory = fakeInventory();
      const stripe = new StripeService(stripeConfig(), fake.prisma, inventory);

      await stripe.handleWebhookEvent({
        id: 'evt_expired_orphan',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_test_dual',
            metadata: {},
          },
        },
      } as never);

      expect(inventory.compensateStripeCheckout).not.toHaveBeenCalled();
    });
  });

  describe('Square POS import success vs failure payloads', () => {
    let fakePrisma: ReturnType<typeof createFakePrisma>;

    beforeEach(() => {
      fakePrisma = createFakePrisma({
        products: [
          { id: '22222222-2222-2222-2222-222222222222', vendorId: VENDOR_ID, name: 'Sourdough Loaf', price: 600 },
        ],
      });
    });

    function importer() {
      const mapping = new PosMappingService(fakePrisma.prisma);
      const analytics = new PosAnalyticsService(fakePrisma.prisma);
      return new PosImportService(fakePrisma.prisma, mapping, analytics);
    }

    it('imports a completed Square transaction into POS storage', async () => {
      const result = await importer().importTransactions(
        squareConnection(),
        SYNC_RUN_ID,
        [squareTxn()],
      );

      expect(result).toMatchObject({ imported: 1, skipped: 0, updated: 0 });
      expect(fakePrisma.store.transactions[0]).toMatchObject({
        state: 'COMPLETED',
        grossAmount: 1200,
        netAmount: 1500,
      });
    });

    it('updates stored state when Square sends a refunded transaction payload', async () => {
      const service = importer();
      await service.importTransactions(squareConnection(), SYNC_RUN_ID, [squareTxn()]);

      const refunded = await service.importTransactions(squareConnection(), SYNC_RUN_ID, [
        squareTxn({ state: 'REFUNDED', raw: { id: 'sq-order-1', state: 'COMPLETED', refunded_money: { amount: 1200 } } }),
      ]);

      expect(refunded).toMatchObject({ imported: 0, updated: 1 });
      expect(fakePrisma.store.transactions[0].state).toBe('REFUNDED');
    });

    it('skips duplicate completed payloads without mutating counts', async () => {
      const service = importer();
      await service.importTransactions(squareConnection(), SYNC_RUN_ID, [squareTxn()]);
      const second = await service.importTransactions(squareConnection(), SYNC_RUN_ID, [squareTxn()]);

      expect(second).toMatchObject({ imported: 0, skipped: 1, updated: 0 });
      expect(fakePrisma.store.transactions).toHaveLength(1);
    });
  });

  describe('Square webhook acceptance vs rejection', () => {
    const adapter = new SquareAdapter(squareConfig());
    const body = JSON.stringify({
      event_id: 'evt-square-1',
      type: 'order.updated',
      merchant_id: 'M1',
      data: { object: { order_id: 'O1', location_id: 'L1' } },
    });
    const notificationUrl = 'https://api.test/pos/webhooks/square';
    const validSignature = createHmac('sha256', 'sig-key')
      .update(notificationUrl + body)
      .digest('base64');

  function buildWebhookService(store: {
    webhookEvents: Array<Record<string, unknown>>;
    connections: Array<Record<string, unknown>>;
  }) {
    const prisma = {
      posWebhookEvent: {
        findUnique: jest.fn(async ({ where }: { where: { provider_providerEventId: { provider: string; providerEventId: string } } }) => {
          const { provider, providerEventId } = where.provider_providerEventId;
          const hit = store.webhookEvents.find(
            (e) => e.provider === provider && e.providerEventId === providerEventId,
          );
          return hit ? { id: hit.id } : null;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `wh-${store.webhookEvents.length + 1}`, ...data };
          store.webhookEvents.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = store.webhookEvents.find((e) => e.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      posConnection: {
        findFirst: jest.fn(async ({ where }: { where: { provider: string; providerMerchantId?: string } }) =>
          store.connections.find(
            (c) =>
              c.provider === where.provider &&
              (!where.providerMerchantId || c.providerMerchantId === where.providerMerchantId),
          ) ?? null,
        ),
      },
    };

    const registry = {
      get: () => adapter,
    };
    const sync = {
      queueSync: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new PosWebhookService(prisma as never, registry as never, sync as never),
      sync,
      store,
    };
  }

    it('accepts a valid Square webhook and queues sync for order events', async () => {
      const store = {
        webhookEvents: [] as Array<Record<string, unknown>>,
        connections: [squareConnection()],
      };
      const { service, sync } = buildWebhookService(store);

      const result = await service.handleInbound({
        provider: 'SQUARE',
        rawBody: body,
        headers: { 'x-square-hmacsha256-signature': validSignature },
      });

      expect(result).toEqual({ accepted: true });
      expect(store.webhookEvents[0]).toMatchObject({
        signatureValid: true,
        status: 'PROCESSED',
        eventType: 'order.updated',
      });
      expect(sync.queueSync).toHaveBeenCalledWith(CONNECTION_ID, 'WEBHOOK');
    });

    it('rejects an invalid Square signature without queueing sync', async () => {
      const store = {
        webhookEvents: [] as Array<Record<string, unknown>>,
        connections: [squareConnection()],
      };
      const { service, sync } = buildWebhookService(store);

      const result = await service.handleInbound({
        provider: 'SQUARE',
        rawBody: body,
        headers: { 'x-square-hmacsha256-signature': 'tampered' },
      });

      expect(result).toEqual({ accepted: false });
      expect(store.webhookEvents[0]).toMatchObject({
        signatureValid: false,
        status: 'FAILED',
      });
      expect(sync.queueSync).not.toHaveBeenCalled();
    });
  });
});
