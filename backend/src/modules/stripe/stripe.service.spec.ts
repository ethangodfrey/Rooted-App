import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import { StripeService } from './stripe.service';
import { STRIPE_PLATFORM_FEE_BPS } from './stripe.constants';
import { createFakeOrderPrisma } from '../../../test/fake-order-prisma';

const mockCheckoutSessionsCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    webhooks: { constructEvent: mockConstructEvent },
    accounts: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    accountLinks: { create: jest.fn() },
  }));
});

const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const VENDOR_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function config(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    WEB_APP_URL: 'https://app.vendorly.test',
    ...overrides,
  };
  return {
    get: (key: string, def?: string) => (key in values ? values[key] : def),
  } as unknown as ConfigService;
}

function baseOrder() {
  return {
    id: ORDER_ID,
    total: 2500,
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

describe('StripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/cs_test_123',
    });
    mockConstructEvent.mockImplementation((_body, _sig, _secret) => ({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: {} },
    }));
  });

  it('reports configured when STRIPE_SECRET_KEY is set', () => {
    const { prisma } = createFakeOrderPrisma();
    const service = new StripeService(config(), prisma);
    expect(service.isConfigured()).toBe(true);
  });

  it('reports not configured without STRIPE_SECRET_KEY', () => {
    const { prisma } = createFakeOrderPrisma();
    const service = new StripeService(config({ STRIPE_SECRET_KEY: '' }), prisma);
    expect(service.isConfigured()).toBe(false);
  });

  it('throws when checkout is requested but Stripe is not configured', async () => {
    const { prisma } = createFakeOrderPrisma([baseOrder()]);
    const service = new StripeService(config({ STRIPE_SECRET_KEY: '' }), prisma);

    await expect(
      service.createOrderCheckoutSession({ orderId: ORDER_ID, customerUserId: CUSTOMER_ID }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('creates a checkout session and marks the order stripe_pending', async () => {
    const fake = createFakeOrderPrisma([baseOrder()]);
    const service = new StripeService(config(), fake.prisma);

    const result = await service.createOrderCheckoutSession({
      orderId: ORDER_ID,
      customerUserId: CUSTOMER_ID,
    });

    expect(result).toEqual({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.test/cs_test_123',
    });

    const expectedFee = Math.round((2500 * STRIPE_PLATFORM_FEE_BPS) / 10_000);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_intent_data: expect.objectContaining({
          application_fee_amount: expectedFee,
          transfer_data: { destination: 'acct_vendor' },
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 2500 }),
          }),
        ],
      }),
    );

    expect(fake.orders[0]).toMatchObject({
      payment_status: 'stripe_pending',
      stripe_checkout_session_id: 'cs_test_123',
    });
  });

  it('rejects checkout when the order is not found', async () => {
    const fake = createFakeOrderPrisma([baseOrder()]);
    const service = new StripeService(config(), fake.prisma);

    await expect(
      service.createOrderCheckoutSession({
        orderId: ORDER_ID,
        customerUserId: 'wrong-customer',
      }),
    ).rejects.toThrow(new BadRequestException('Order not found for this customer.'));
  });

  it('rejects checkout when the order is already paid', async () => {
    const fake = createFakeOrderPrisma([
      { ...baseOrder(), payment_status: 'paid_online' },
    ]);
    const service = new StripeService(config(), fake.prisma);

    await expect(
      service.createOrderCheckoutSession({ orderId: ORDER_ID, customerUserId: CUSTOMER_ID }),
    ).rejects.toThrow(new BadRequestException('Order is already paid.'));
  });

  it('rejects checkout when the vendor has not completed Stripe onboarding', async () => {
    const fake = createFakeOrderPrisma([
      { ...baseOrder(), stripe_account_id: null, stripe_charges_enabled: false },
    ]);
    const service = new StripeService(config(), fake.prisma);

    await expect(
      service.createOrderCheckoutSession({ orderId: ORDER_ID, customerUserId: CUSTOMER_ID }),
    ).rejects.toThrow(
      new BadRequestException('Vendor has not completed Stripe onboarding.'),
    );
  });

  it('verifies webhook signatures and requires the Stripe-Signature header', () => {
    const fake = createFakeOrderPrisma();
    const service = new StripeService(config(), fake.prisma);

    mockConstructEvent.mockReturnValue({ id: 'evt_1', type: 'ping', data: {} });

    expect(service.verifyWebhook(Buffer.from('{}'), 'sig_header')).toEqual({
      id: 'evt_1',
      type: 'ping',
      data: {},
    });

    expect(() => service.verifyWebhook(Buffer.from('{}'), undefined)).toThrow(
      new BadRequestException('Missing Stripe-Signature header.'),
    );
  });

  it('marks the order paid_online when checkout.session.completed is received', async () => {
    const fake = createFakeOrderPrisma([
      {
        ...baseOrder(),
        payment_status: 'stripe_pending',
        stripe_checkout_session_id: 'cs_test_123',
      },
    ]);
    const service = new StripeService(config(), fake.prisma);

    const session = {
      id: 'cs_test_123',
      metadata: { order_id: ORDER_ID },
      payment_intent: 'pi_test_456',
    } as unknown as Stripe.Checkout.Session;

    mockConstructEvent.mockReturnValue({
      id: 'evt_completed',
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const event = service.verifyWebhook(Buffer.from('{}'), 'sig');
    await service.handleWebhookEvent(event);

    expect(fake.orders[0]).toMatchObject({
      payment_status: 'paid_online',
      stripe_payment_intent_id: 'pi_test_456',
    });
  });

  it('does not mark paid when the checkout session id does not match', async () => {
    const fake = createFakeOrderPrisma([
      {
        ...baseOrder(),
        payment_status: 'stripe_pending',
        stripe_checkout_session_id: 'cs_other',
      },
    ]);
    const service = new StripeService(config(), fake.prisma);

    const session = {
      id: 'cs_test_123',
      metadata: { order_id: ORDER_ID },
      payment_intent: 'pi_test_456',
    } as unknown as Stripe.Checkout.Session;

    await service.handleWebhookEvent({
      id: 'evt_completed',
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event);

    expect(fake.orders[0].payment_status).toBe('stripe_pending');
    expect(fake.orders[0].stripe_payment_intent_id).toBeNull();
  });

  it('ignores checkout.session.completed when order_id metadata is missing', async () => {
    const fake = createFakeOrderPrisma([
      {
        ...baseOrder(),
        payment_status: 'stripe_pending',
        stripe_checkout_session_id: 'cs_test_123',
      },
    ]);
    const service = new StripeService(config(), fake.prisma);

    await service.handleWebhookEvent({
      id: 'evt_completed',
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_test_123', metadata: {}, payment_intent: 'pi_test_456' },
      },
    } as Stripe.Event);

    expect(fake.orders[0].payment_status).toBe('stripe_pending');
  });
});
