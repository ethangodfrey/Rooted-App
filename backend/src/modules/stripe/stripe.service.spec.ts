import type { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import type { CheckoutInventoryService } from '../checkout/checkout-inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';

const constructEvent = jest.fn();
const accountsRetrieve = jest.fn();
const checkoutSessionsCreate = jest.fn();
const accountLinksCreate = jest.fn();
const accountsCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent },
    accounts: { retrieve: accountsRetrieve, create: accountsCreate },
    checkout: { sessions: { create: checkoutSessionsCreate } },
    accountLinks: { create: accountLinksCreate },
  }));
});

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_mock',
    WEB_APP_URL: 'http://localhost:5173',
    ...overrides,
  };
  return {
    get: (key: string, def?: string) => (key in values ? values[key] : def),
  } as unknown as ConfigService;
}

function fakeInventory(): CheckoutInventoryService {
  return {
    finalizePaidOrder: jest.fn(async () => undefined),
    compensateStripeCheckout: jest.fn(async () => undefined),
    reserveForStripeCheckout: jest.fn(async () => undefined),
    decrementPresale: jest.fn(async () => undefined),
  } as unknown as CheckoutInventoryService;
}

function fakePrisma() {
  const executeRawCalls: unknown[][] = [];
  const vendorUpdateManyCalls: unknown[] = [];

  const tx = {
    $executeRaw: jest.fn(async (...args: unknown[]) => {
      executeRawCalls.push(args);
    }),
    $queryRaw: jest.fn(async () => [
      {
        id: 'order-abc',
        transaction_id: 'txn-1',
        vendor_id: 'vendor-xyz',
        total: 1000,
        platform_fee: 50,
      },
    ]),
  };

  const prisma = {
    $executeRaw: jest.fn(async (...args: unknown[]) => {
      executeRawCalls.push(args);
    }),
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    vendor: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async (...args: unknown[]) => {
        vendorUpdateManyCalls.push(args);
        return { count: 1 };
      }),
    },
  } as unknown as PrismaService;

  return { prisma, executeRawCalls, vendorUpdateManyCalls, tx };
}

describe('StripeService payment webhook handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks an order paid_online when checkout.session.completed succeeds', async () => {
    const { prisma, executeRawCalls } = fakePrisma();
    const inventory = fakeInventory();
    const service = new StripeService(fakeConfig(), prisma, inventory);

    const session = {
      id: 'cs_test_123',
      payment_intent: 'pi_test_456',
      metadata: {
        order_id: 'order-abc',
        vendor_id: 'vendor-xyz',
        customer_user_id: 'user-1',
        transaction_id: 'txn-1',
      },
    } as unknown as Stripe.Checkout.Session;

    await service.handleWebhookEvent({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: session },
    } as unknown as Stripe.Event);

    expect(inventory.finalizePaidOrder).toHaveBeenCalledWith(expect.anything(), 'order-abc', 'user-1');
    expect(executeRawCalls.length).toBeGreaterThan(0);
  });

  it('ignores checkout.session.completed when order_id metadata is missing', async () => {
    const { prisma, executeRawCalls } = fakePrisma();
    const inventory = fakeInventory();
    const service = new StripeService(fakeConfig(), prisma, inventory);

    await service.handleWebhookEvent({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_orphan',
          payment_intent: 'pi_orphan',
          metadata: {},
        },
      },
    } as unknown as Stripe.Event);

    expect(inventory.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('compensates checkout inventory on checkout.session.expired', async () => {
    const { prisma } = fakePrisma();
    const inventory = fakeInventory();
    const service = new StripeService(fakeConfig(), prisma, inventory);

    const pendingSelect = jest.fn(async () => [{ id: 'order-abc' }]);
    const tx = {
      $queryRaw: pendingSelect,
      $executeRaw: jest.fn(),
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    );

    await service.handleWebhookEvent({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: {
            order_id: 'order-abc',
            customer_user_id: 'user-1',
          },
        },
      },
    } as unknown as Stripe.Event);

    expect(inventory.compensateStripeCheckout).toHaveBeenCalledWith(
      expect.anything(),
      'order-abc',
      'user-1',
    );
    expect(inventory.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('skips compensation when expired session metadata is incomplete', async () => {
    const { prisma } = fakePrisma();
    const inventory = fakeInventory();
    const service = new StripeService(fakeConfig(), prisma, inventory);

    await service.handleWebhookEvent({
      id: 'evt_expired_bad',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: { order_id: 'order-abc' },
        },
      },
    } as unknown as Stripe.Event);

    expect(inventory.compensateStripeCheckout).not.toHaveBeenCalled();
  });

  it('updates vendor Connect flags on account.updated', async () => {
    const { prisma, vendorUpdateManyCalls } = fakePrisma();
    const service = new StripeService(fakeConfig(), prisma, fakeInventory());

    await service.handleWebhookEvent({
      id: 'evt_3',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_vendor',
          charges_enabled: true,
          payouts_enabled: false,
          metadata: { vendor_id: 'vendor-1' },
        },
      },
    } as unknown as Stripe.Event);

    expect(vendorUpdateManyCalls).toHaveLength(1);
    expect(vendorUpdateManyCalls[0]).toEqual([
      {
        where: { stripeAccountId: 'acct_vendor' },
        data: {
          stripeChargesEnabled: true,
          stripePayoutsEnabled: false,
          payoutsEnabled: false,
        },
      },
    ]);
  });

  it('no-ops unknown webhook event types', async () => {
    const { prisma, executeRawCalls, vendorUpdateManyCalls } = fakePrisma();
    const inventory = fakeInventory();
    const service = new StripeService(fakeConfig(), prisma, inventory);

    await service.handleWebhookEvent({
      id: 'evt_4',
      type: 'customer.created',
      data: { object: {} },
    } as unknown as Stripe.Event);

    expect(inventory.finalizePaidOrder).not.toHaveBeenCalled();
    expect(vendorUpdateManyCalls).toHaveLength(0);
  });

  describe('verifyWebhook', () => {
    it('delegates signature verification to Stripe SDK', () => {
      const { prisma } = fakePrisma();
      const service = new StripeService(fakeConfig(), prisma, fakeInventory());
      const event = { id: 'evt_verified', type: 'ping' };
      constructEvent.mockReturnValue(event);

      const rawBody = Buffer.from('{"id":"evt_verified"}');
      const result = service.verifyWebhook(rawBody, 'sig_header');

      expect(constructEvent).toHaveBeenCalledWith(rawBody, 'sig_header', 'whsec_mock');
      expect(result).toBe(event);
    });

    it('throws when signature header is missing', () => {
      const { prisma } = fakePrisma();
      const service = new StripeService(fakeConfig(), prisma, fakeInventory());

      expect(() => service.verifyWebhook('{}', undefined)).toThrow(/Missing Stripe-Signature/);
    });
  });
});
