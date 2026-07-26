import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import type { PaymentClearingService } from '../financial/payment-clearing.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PaymentsGatewayService } from './payments-gateway.service';
import type { StripeService } from './stripe.service';

const REFERENCE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TRANSACTION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const STRIPE_ACCOUNT_ID = 'acct_vendor_123';

const checkoutSessionsCreate = jest.fn();

function fakeConfig(): ConfigService {
  return {
    get: (key: string, def?: string) =>
      ({
        WEB_APP_URL: 'https://app.vendorly.test',
      })[key] ?? def,
  } as unknown as ConfigService;
}

function buildService(overrides?: {
  holdInEscrow?: jest.Mock;
  verifyWebhook?: jest.Mock;
  executeRaw?: jest.Mock;
  queryRaw?: jest.Mock;
  checkoutSessionsCreate?: jest.Mock;
}) {
  const holdInEscrow =
    overrides?.holdInEscrow ??
    jest.fn(async () => ({
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      TRANSACTION_ID,
    }));
  const verifyWebhook = overrides?.verifyWebhook ?? jest.fn();
  const executeRaw = overrides?.executeRaw ?? jest.fn(async () => 1);
  const queryRaw = overrides?.queryRaw ?? jest.fn(async () => []);

  const clearing = { holdInEscrow } as unknown as PaymentClearingService;
  const stripe = {
    verifyWebhook,
    requireClient: jest.fn(() => ({
      checkout: { sessions: { create: overrides?.checkoutSessionsCreate ?? checkoutSessionsCreate } },
    })),
  } as unknown as StripeService;
  const prisma = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  } as unknown as PrismaService;

  const service = new PaymentsGatewayService(fakeConfig(), prisma, stripe, clearing);
  return { service, holdInEscrow, verifyWebhook, executeRaw, prisma, queryRaw };
}

function escrowCompletedSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: 'cs_success',
    payment_intent: 'pi_success',
    amount_total: 1800,
    metadata: {
      reference_id: REFERENCE_ID,
      purpose: 'ESCROW_HOLD',
      amount_cents: '1800',
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe('PaymentsGatewayService webhook processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkoutSessionsCreate.mockResolvedValue({
      id: 'cs_created',
      url: 'https://checkout.stripe.test/cs_created',
    });
  });

  it('holds escrow funds on successful checkout.session.completed payloads', async () => {
    const { service, holdInEscrow, verifyWebhook, executeRaw } = buildService();
    verifyWebhook.mockReturnValue({
      id: 'evt_success',
      type: 'checkout.session.completed',
      data: { object: escrowCompletedSession() },
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig_ok');

    expect(holdInEscrow).toHaveBeenCalledWith(REFERENCE_ID, 1800);
    expect(executeRaw).toHaveBeenCalled();
    expect(result).toMatchObject({
      STATUS: 'PAYMENT_WEBHOOKS_ACTIVE',
      EVENT_TYPE: 'checkout.session.completed',
      EVENT_ID: 'evt_success',
    });
  });

  it('uses session amount_total when metadata amount_cents is missing', async () => {
    const { service, holdInEscrow, verifyWebhook } = buildService();
    verifyWebhook.mockReturnValue({
      id: 'evt_amount_fallback',
      type: 'checkout.session.completed',
      data: {
        object: escrowCompletedSession({
          metadata: {
            reference_id: REFERENCE_ID,
            purpose: 'ESCROW_HOLD',
          },
          amount_total: 2500,
        }),
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig_ok');

    expect(holdInEscrow).toHaveBeenCalledWith(REFERENCE_ID, 2500);
  });

  it('skips escrow mutation when reference_id metadata is missing', async () => {
    const { service, holdInEscrow, verifyWebhook } = buildService();
    verifyWebhook.mockReturnValue({
      id: 'evt_no_ref',
      type: 'checkout.session.completed',
      data: {
        object: escrowCompletedSession({
          metadata: { purpose: 'ESCROW_HOLD', amount_cents: '1800' },
        }),
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig_ok');

    expect(holdInEscrow).not.toHaveBeenCalled();
  });

  it('delegates non-escrow checkout sessions to legacy order handlers', async () => {
    const { service, holdInEscrow, verifyWebhook } = buildService();
    verifyWebhook.mockReturnValue({
      id: 'evt_order_checkout',
      type: 'checkout.session.completed',
      data: {
        object: escrowCompletedSession({
          metadata: {
            reference_id: REFERENCE_ID,
            purpose: 'ORDER_CHECKOUT',
            order_id: 'order-1',
            amount_cents: '1800',
          },
        }),
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig_ok');

    expect(holdInEscrow).not.toHaveBeenCalled();
  });

  it('throws when the webhook amount resolves to zero', async () => {
    const { service, holdInEscrow, verifyWebhook } = buildService();
    verifyWebhook.mockReturnValue({
      id: 'evt_zero_amount',
      type: 'checkout.session.completed',
      data: {
        object: escrowCompletedSession({
          amount_total: 0,
          metadata: {
            reference_id: REFERENCE_ID,
            purpose: 'ESCROW_HOLD',
            amount_cents: '0',
          },
        }),
      },
    });

    await expect(service.handleWebhook(Buffer.from('{}'), 'sig_bad_amount')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(holdInEscrow).not.toHaveBeenCalled();
  });

  it('ignores unrelated Stripe webhook event types', async () => {
    const { service, holdInEscrow, verifyWebhook } = buildService();
    verifyWebhook.mockReturnValue({
      id: 'evt_other',
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_failed' } },
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig_fail');

    expect(holdInEscrow).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      EVENT_TYPE: 'payment_intent.payment_failed',
      EVENT_ID: 'evt_other',
    });
  });

  it('persists Stripe payment metadata when holdInEscrow returns a transaction id', async () => {
    const executeRaw = jest.fn(async () => 1);
    const { service, verifyWebhook } = buildService({ executeRaw });
    verifyWebhook.mockReturnValue({
      id: 'evt_metadata',
      type: 'checkout.session.completed',
      data: {
        object: escrowCompletedSession({
          payment_intent: 'pi_metadata',
        }),
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig_ok');

    expect(executeRaw).toHaveBeenCalled();
  });
});

describe('PaymentsGatewayService checkout session creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkoutSessionsCreate.mockResolvedValue({
      id: 'cs_created',
      url: 'https://checkout.stripe.test/cs_created',
    });
  });

  it('creates a Stripe Checkout session for a catering inquiry reference', async () => {
    const queryRaw = jest.fn(async () => [{ id: REFERENCE_ID, stripe_account_id: STRIPE_ACCOUNT_ID }]);
    const { service } = buildService({ queryRaw });

    const result = await service.createCheckoutSession({
      referenceId: REFERENCE_ID,
      amount: 1800,
    });

    expect(queryRaw).toHaveBeenCalled();
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({
          reference_id: REFERENCE_ID,
          reference_type: 'CATERING',
          purpose: 'ESCROW_HOLD',
        }),
        payment_intent_data: expect.objectContaining({
          application_fee_amount: 90,
          transfer_data: { destination: STRIPE_ACCOUNT_ID },
        }),
      }),
    );
    expect(result).toMatchObject({
      STATUS: 'STRIPE_GATEWAY_INITIALIZED',
      ACTION: 'CHECKOUT_CREATED',
      REFERENCE_ID,
      REFERENCE_TYPE: 'CATERING',
      AMOUNT_CENTS: 1800,
      SESSION_ID: 'cs_created',
      URL: 'https://checkout.stripe.test/cs_created',
    });
  });

  it('creates a wholesale procurement checkout without Connect transfer when no account is linked', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: REFERENCE_ID, stripe_account_id: null }]);
    const { service } = buildService({ queryRaw });

    const result = await service.createCheckoutSession({
      referenceId: REFERENCE_ID,
      amount: 2500,
    });

    expect(result.REFERENCE_TYPE).toBe('B2B_PROCUREMENT');
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          reference_type: 'B2B_PROCUREMENT',
        }),
        payment_intent_data: expect.not.objectContaining({
          transfer_data: expect.anything(),
        }),
      }),
    );
  });

  it('rejects checkout creation when reference id is blank', async () => {
    const { service } = buildService();

    await expect(
      service.createCheckoutSession({ referenceId: '   ', amount: 500 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects checkout creation when amount is below the Stripe minimum', async () => {
    const { service } = buildService();

    await expect(
      service.createCheckoutSession({ referenceId: REFERENCE_ID, amount: 25 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('throws when the reference id cannot be resolved', async () => {
    const { service } = buildService({ queryRaw: jest.fn(async () => []) });

    await expect(
      service.createCheckoutSession({ referenceId: REFERENCE_ID, amount: 500 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });
});
