import type { PosConnection } from '@prisma/client';

import { SquareAdapter } from '../src/modules/pos/adapters/square/square.adapter';
import { PosImportService } from '../src/modules/pos/services/pos-import.service';
import { PosMappingService } from '../src/modules/pos/services/pos-mapping.service';
import { PosAnalyticsService } from '../src/modules/pos/services/pos-analytics.service';
import type { NormalizedTransaction } from '../src/modules/pos/types/normalized-transaction';
import type { ConfigService } from '@nestjs/config';
import { StripeService } from '../src/modules/stripe/stripe.service';
import type { SquareIntegrationService } from '../src/modules/pos/services/square-integration.service';
import { createFakeOrderPrisma } from './fake-order-prisma';
import { createFakePrisma } from './fake-prisma';

const constructEvent = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent },
    accounts: { retrieve: jest.fn(), create: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    accountLinks: { create: jest.fn() },
  }));
});

const VENDOR_ID = '11111111-1111-1111-1111-111111111111';
const CONNECTION_ID = '33333333-3333-3333-3333-333333333333';
const SYNC_RUN_ID = '44444444-4444-4444-4444-444444444444';

function squareAdapter(): SquareAdapter {
  return new SquareAdapter({
    get: (key: string, def?: string) => {
      const config: Record<string, string> = {
        SQUARE_ENVIRONMENT: 'sandbox',
        SQUARE_APPLICATION_ID: 'app-id',
        SQUARE_APPLICATION_SECRET: 'app-secret',
        PUBLIC_BASE_URL: 'https://api.test',
      };
      return key in config ? config[key] : def;
    },
  } as unknown as ConfigService);
}

function normalizeSquareOrder(adapter: SquareAdapter, order: unknown): NormalizedTransaction {
  return (
    adapter as unknown as { normalizeOrder: (o: unknown) => NormalizedTransaction }
  ).normalizeOrder(order);
}

function connection(): PosConnection {
  return {
    id: CONNECTION_ID,
    vendorId: VENDOR_ID,
    provider: 'SQUARE',
    providerLocationId: null,
  } as unknown as PosConnection;
}


function fakeSquareIntegration(): SquareIntegrationService {
  return {
    deductSquareInventory: jest.fn(async () => ({
      STATUS: 'SQUARE_DEDUCT_SKIPPED',
      VENDOR_ID: '',
      SKU: '',
      QUANTITY: 0,
      MODE: 'SKIP',
    })),
    extractCheckoutDeductionLines: jest.fn(() => []),
  } as unknown as SquareIntegrationService;
}

describe('Dual payment transaction parsing (Stripe + Square)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Stripe checkout webhooks mutate order payment state', () => {
    it('transitions stripe_pending orders to paid_online on success payloads', async () => {
      const executeRaw = jest.fn();
      const prisma = {
        $executeRaw: executeRaw,
        $queryRaw: jest.fn(async () => []),
        $transaction: jest.fn(async (fn: (tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock }) => unknown) =>
          fn({ $queryRaw: jest.fn(async () => []), $executeRaw: executeRaw }),
        ),
        vendor: {},
      } as never;
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        prisma,
        {
          finalizePaidOrder: jest.fn(),
          compensateStripeCheckout: jest.fn(),
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_success',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_live_ok',
            payment_intent: 'pi_live_ok',
            metadata: {
              order_id: 'order-1',
              vendor_id: VENDOR_ID,
              customer_user_id: 'user-1',
            },
          },
        },
      } as never);

      expect(executeRaw).toHaveBeenCalled();
    });

    it('does not mutate orders on malformed success payloads missing order_id', async () => {
      const finalizePaidOrder = jest.fn();
      const executeRaw = jest.fn();
      const prisma = {
        $executeRaw: executeRaw,
        $queryRaw: jest.fn(async () => []),
        $transaction: jest.fn(async (fn: (tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock }) => unknown) =>
          fn({ $queryRaw: jest.fn(async () => []), $executeRaw: executeRaw }),
        ),
        vendor: {},
      } as never;
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        prisma,
        {
          finalizePaidOrder,
          compensateStripeCheckout: jest.fn(),
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_bad',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_live_bad',
            payment_intent: 'pi_live_bad',
            metadata: {},
          },
        },
      } as never);

      expect(finalizePaidOrder).not.toHaveBeenCalled();
    });

    it('does not finalize inventory when checkout succeeds but order is not stripe_pending', async () => {
      const finalizePaidOrder = jest.fn();
      const fake = createFakeOrderPrisma([
        {
          id: 'order-already-paid',
          total: 1500,
          payment_status: 'paid_online',
          stripe_checkout_session_id: 'cs_already_paid',
          stripe_payment_intent_id: 'pi_existing',
          vendor_id: VENDOR_ID,
          business_name: 'River Farm',
          stripe_account_id: 'acct_vendor',
          stripe_charges_enabled: true,
          customer_user_id: 'user-paid',
        },
      ]);
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        fake.prisma,
        {
          finalizePaidOrder,
          compensateStripeCheckout: jest.fn(),
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_duplicate_success',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_already_paid',
            payment_intent: 'pi_retry',
            metadata: {
              order_id: 'order-already-paid',
              customer_user_id: 'user-paid',
            },
          },
        },
      } as never);

      expect(finalizePaidOrder).not.toHaveBeenCalled();
      expect(fake.orders[0].payment_status).toBe('paid_online');
      expect(fake.orders[0].stripe_payment_intent_id).toBe('pi_existing');
    });

    it('compensates inventory when checkout.session.expired fires for a pending order', async () => {
      const compensateStripeCheckout = jest.fn();
      const fake = createFakeOrderPrisma([
        {
          id: 'order-expired',
          total: 1200,
          payment_status: 'stripe_pending',
          stripe_checkout_session_id: 'cs_expired',
          stripe_payment_intent_id: null,
          vendor_id: VENDOR_ID,
          business_name: 'River Farm',
          stripe_account_id: 'acct_vendor',
          stripe_charges_enabled: true,
          customer_user_id: 'user-expired',
        },
      ]);
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        fake.prisma,
        {
          finalizePaidOrder: jest.fn(),
          compensateStripeCheckout,
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_expired',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_expired',
            metadata: {
              order_id: 'order-expired',
              customer_user_id: 'user-expired',
            },
          },
        },
      } as never);

      expect(compensateStripeCheckout).toHaveBeenCalledWith(
        expect.anything(),
        'order-expired',
        'user-expired',
      );
    });

    it('ignores expired checkout webhooks when customer_user_id metadata is missing', async () => {
      const compensateStripeCheckout = jest.fn();
      const fake = createFakeOrderPrisma([
        {
          id: 'order-expired-no-user',
          total: 1200,
          payment_status: 'stripe_pending',
          stripe_checkout_session_id: 'cs_expired_no_user',
          stripe_payment_intent_id: null,
          vendor_id: VENDOR_ID,
          business_name: 'River Farm',
          stripe_account_id: 'acct_vendor',
          stripe_charges_enabled: true,
          customer_user_id: 'user-expired',
        },
      ]);
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        fake.prisma,
        {
          finalizePaidOrder: jest.fn(),
          compensateStripeCheckout,
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_expired_no_user',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_expired_no_user',
            metadata: { order_id: 'order-expired-no-user' },
          },
        },
      } as never);

      expect(compensateStripeCheckout).not.toHaveBeenCalled();
      expect(fake.orders[0].payment_status).toBe('stripe_pending');
    });
  });

  describe('Square POS payloads drive imported transaction state', () => {
    const adapter = squareAdapter();

    it('imports completed Square sales and marks transactions COMPLETED', async () => {
      const fake = createFakePrisma();
      const importer = new PosImportService(
        fake.prisma,
        new PosMappingService(fake.prisma),
        new PosAnalyticsService(fake.prisma),
      );

      const txn = normalizeSquareOrder(adapter, {
        id: 'sq-ok-1',
        location_id: 'L1',
        state: 'COMPLETED',
        closed_at: '2026-06-08T15:30:00.000Z',
        total_money: { amount: 1200, currency: 'USD' },
        line_items: [
          {
            uid: 'li-1',
            name: 'Eggs',
            quantity: '1',
            gross_sales_money: { amount: 1200 },
          },
        ],
      });

      const result = await importer.importTransactions(connection(), SYNC_RUN_ID, [txn]);

      expect(result).toMatchObject({ imported: 1, skipped: 0, updated: 0 });
      expect(fake.store.transactions[0]).toMatchObject({
        providerTransactionId: 'sq-ok-1',
        state: 'COMPLETED',
        grossAmount: 1200,
      });
    });

    it('updates imported transactions to REFUNDED on Square refund failure payloads', async () => {
      const fake = createFakePrisma();
      const importer = new PosImportService(
        fake.prisma,
        new PosMappingService(fake.prisma),
        new PosAnalyticsService(fake.prisma),
      );

      const completed = normalizeSquareOrder(adapter, {
        id: 'sq-refund-1',
        state: 'COMPLETED',
        closed_at: '2026-06-08T15:30:00.000Z',
        total_money: { amount: 900, currency: 'USD' },
        refunded_money: { amount: 0 },
        line_items: [{ uid: 'li-1', name: 'Jam', quantity: '1', gross_sales_money: { amount: 900 } }],
      });

      await importer.importTransactions(connection(), SYNC_RUN_ID, [completed]);

      const refunded = normalizeSquareOrder(adapter, {
        id: 'sq-refund-1',
        state: 'COMPLETED',
        closed_at: '2026-06-08T15:30:00.000Z',
        total_money: { amount: 900, currency: 'USD' },
        refunded_money: { amount: 900 },
        line_items: [{ uid: 'li-1', name: 'Jam', quantity: '1', gross_sales_money: { amount: 900 } }],
      });

      const result = await importer.importTransactions(connection(), SYNC_RUN_ID, [refunded]);

      expect(result).toMatchObject({ imported: 0, skipped: 0, updated: 1 });
      expect(fake.store.transactions[0].state).toBe('REFUNDED');
    });

    it('maps partial Square refunds to PARTIALLY_REFUNDED', async () => {
      const fake = createFakePrisma();
      const importer = new PosImportService(
        fake.prisma,
        new PosMappingService(fake.prisma),
        new PosAnalyticsService(fake.prisma),
      );

      const partialRefund = normalizeSquareOrder(adapter, {
        id: 'sq-partial-1',
        state: 'COMPLETED',
        closed_at: '2026-06-08T15:30:00.000Z',
        total_money: { amount: 1000, currency: 'USD' },
        refunded_money: { amount: 400 },
        line_items: [{ uid: 'li-1', name: 'Bread', quantity: '1', gross_sales_money: { amount: 1000 } }],
      });

      const result = await importer.importTransactions(connection(), SYNC_RUN_ID, [partialRefund]);

      expect(result.imported).toBe(1);
      expect(fake.store.transactions[0]).toMatchObject({
        providerTransactionId: 'sq-partial-1',
        state: 'PARTIALLY_REFUNDED',
        grossAmount: 1000,
      });
    });

    it('maps canceled Square orders to VOIDED and still imports auditably', async () => {
      const fake = createFakePrisma();
      const importer = new PosImportService(
        fake.prisma,
        new PosMappingService(fake.prisma),
        new PosAnalyticsService(fake.prisma),
      );

      const voided = normalizeSquareOrder(adapter, {
        id: 'sq-void-1',
        state: 'CANCELED',
        total_money: { amount: 0, currency: 'USD' },
        line_items: [],
      });

      const result = await importer.importTransactions(connection(), SYNC_RUN_ID, [voided]);

      expect(result.imported).toBe(1);
      expect(fake.store.transactions[0]).toMatchObject({
        providerTransactionId: 'sq-void-1',
        state: 'VOIDED',
        grossAmount: 0,
      });
    });

    it('normalizes string cent amounts from Square money fields', () => {
      const txn = normalizeSquareOrder(adapter, {
        id: 'sq-string-cents',
        state: 'COMPLETED',
        closed_at: '2026-06-08T15:30:00.000Z',
        total_money: { amount: '2450', currency: 'USD' },
        line_items: [
          {
            uid: 'li-1',
            name: 'Honey',
            quantity: '2',
            gross_sales_money: { amount: '2450' },
          },
        ],
      });

      expect(txn).toMatchObject({
        grossAmount: 2450,
        lineItems: [{ grossAmount: 2450, quantity: 2 }],
      });
    });

    it('treats missing Square money fields as zero cents', () => {
      const txn = normalizeSquareOrder(adapter, {
        id: 'sq-empty-money',
        state: 'COMPLETED',
        closed_at: '2026-06-08T15:30:00.000Z',
        line_items: [],
      });

      expect(txn.grossAmount).toBe(0);
      expect(txn.netAmount).toBe(0);
    });
  });

  describe('Stripe checkout success mutates stripe_pending orders end-to-end', () => {
    it('finalizes inventory and marks the order paid_online on success payloads', async () => {
      const finalizePaidOrder = jest.fn();
      const fake = createFakeOrderPrisma([
        {
          id: 'order-success',
          total: 1800,
          payment_status: 'stripe_pending',
          stripe_checkout_session_id: 'cs_success',
          stripe_payment_intent_id: null,
          vendor_id: VENDOR_ID,
          business_name: 'River Farm',
          stripe_account_id: 'acct_vendor',
          stripe_charges_enabled: true,
          customer_user_id: 'user-success',
        },
      ]);
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        fake.prisma,
        {
          finalizePaidOrder,
          compensateStripeCheckout: jest.fn(),
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_success_e2e',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_success',
            payment_intent: 'pi_success',
            metadata: {
              order_id: 'order-success',
              customer_user_id: 'user-success',
            },
          },
        },
      } as never);

      expect(finalizePaidOrder).toHaveBeenCalledWith(
        expect.anything(),
        'order-success',
        'user-success',
      );
      expect(fake.orders[0]).toMatchObject({
        payment_status: 'paid_online',
        stripe_payment_intent_id: 'pi_success',
      });
    });

    it('leaves stripe_pending orders unchanged when session id does not match', async () => {
      const finalizePaidOrder = jest.fn();
      const fake = createFakeOrderPrisma([
        {
          id: 'order-mismatch',
          total: 1200,
          payment_status: 'stripe_pending',
          stripe_checkout_session_id: 'cs_expected',
          stripe_payment_intent_id: null,
          vendor_id: VENDOR_ID,
          business_name: 'River Farm',
          stripe_account_id: 'acct_vendor',
          stripe_charges_enabled: true,
          customer_user_id: 'user-mismatch',
        },
      ]);
      const stripe = new StripeService(
        {
          get: (key: string, def?: string) =>
            ({
              STRIPE_SECRET_KEY: 'sk_test',
              STRIPE_WEBHOOK_SECRET: 'whsec_test',
            })[key] ?? def,
        } as ConfigService,
        fake.prisma,
        {
          finalizePaidOrder,
          compensateStripeCheckout: jest.fn(),
        } as never,
        fakeSquareIntegration(),
      );

      await stripe.handleWebhookEvent({
        id: 'evt_mismatch',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_wrong_session',
            payment_intent: 'pi_wrong',
            metadata: {
              order_id: 'order-mismatch',
              customer_user_id: 'user-mismatch',
            },
          },
        },
      } as never);

      expect(finalizePaidOrder).not.toHaveBeenCalled();
      expect(fake.orders[0].payment_status).toBe('stripe_pending');
      expect(fake.orders[0].stripe_payment_intent_id).toBeNull();
    });
  });
});
