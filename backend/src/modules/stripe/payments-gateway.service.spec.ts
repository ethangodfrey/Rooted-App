import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import type { PaymentClearingService } from '../financial/payment-clearing.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PaymentsGatewayService } from './payments-gateway.service';
import type { StripeService } from './stripe.service';
import type { SquareIntegrationService } from '../pos/services/square-integration.service';

const REFERENCE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TRANSACTION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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
}) {
  const holdInEscrow =
    overrides?.holdInEscrow ??
    jest.fn(async () => ({
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      TRANSACTION_ID,
    }));
  const verifyWebhook = overrides?.verifyWebhook ?? jest.fn();
  const executeRaw = overrides?.executeRaw ?? jest.fn(async () => 1);

  const clearing = { holdInEscrow } as unknown as PaymentClearingService;
  const stripe = {
    verifyWebhook,
    requireClient: jest.fn(),
  } as unknown as StripeService;
  const prisma = {
    $queryRaw: jest.fn(async () => []),
    $executeRaw: executeRaw,
  } as unknown as PrismaService;

  const square = {
    deductSquareInventory: jest.fn(async () => ({
      STATUS: 'SQUARE_DEDUCT_SKIPPED',
      VENDOR_ID: '',
      SKU: '',
      QUANTITY: 0,
      MODE: 'SKIP',
    })),
    extractCheckoutDeductionLines: jest.fn(() => []),
  } as unknown as SquareIntegrationService;
  const service = new PaymentsGatewayService(fakeConfig(), prisma, stripe, clearing, square);
  return { service, holdInEscrow, verifyWebhook, executeRaw, prisma, square };
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
