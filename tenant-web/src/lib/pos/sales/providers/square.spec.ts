import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseSquareSalesWebhook } from './square';

const NOTIFICATION_URL = 'https://api.vendorly.test/api/webhooks/pos-sales';
const SIGNATURE_KEY = 'test-sig-key';

function signBody(rawBody: string): string {
  return createHmac('sha256', SIGNATURE_KEY).update(NOTIFICATION_URL + rawBody).digest('base64');
}

function paymentPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event_id: 'evt-payment-1',
    type: 'payment.updated',
    merchant_id: 'merchant-1',
    data: {
      object: {
        payment: {
          id: 'pay-1',
          order_id: 'order-1',
          location_id: 'loc-1',
          status: 'COMPLETED',
          created_at: '2026-07-10T12:00:00.000Z',
          amount_money: { amount: 1500, currency: 'USD' },
          tip_money: { amount: 200, currency: 'USD' },
          source_type: 'CARD',
          card_details: { card: { card_brand: 'VISA' } },
          ...overrides,
        },
      },
    },
  });
}

describe('parseSquareSalesWebhook', () => {
  beforeEach(() => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = SIGNATURE_KEY;
    process.env.POS_SALES_WEBHOOK_URL = NOTIFICATION_URL;
    process.env.VENDORLY_PLATFORM_FEE_BPS = '250';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses a completed payment success payload with a valid signature', () => {
    const rawBody = paymentPayload();
    const parsed = parseSquareSalesWebhook(rawBody, {
      'x-square-hmacsha256-signature': signBody(rawBody),
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.signatureValid).toBe(true);
    expect(parsed?.provider).toBe('square');
    expect(parsed?.eventType).toBe('payment.updated');
    expect(parsed?.transactions).toHaveLength(1);
    expect(parsed?.transactions[0]).toMatchObject({
      externalTransactionId: 'pay-1',
      state: 'completed',
      grossAmountCents: 1500,
      tenderType: 'card',
      cardBrand: 'VISA',
    });
    expect(parsed?.transactions[0].platformFeeCents).toBe(38);
  });

  it('returns null for unrelated webhook event types', () => {
    const rawBody = JSON.stringify({ type: 'inventory.count.updated', event_id: 'evt-inv' });
    expect(parseSquareSalesWebhook(rawBody, {})).toBeNull();
  });

  it('marks invalid signatures without dropping parsed transaction data', () => {
    const rawBody = paymentPayload();
    const parsed = parseSquareSalesWebhook(rawBody, {
      'x-square-hmacsha256-signature': 'tampered-signature',
    });

    expect(parsed?.signatureValid).toBe(false);
    expect(parsed?.transactions).toHaveLength(1);
    expect(parsed?.transactions[0].state).toBe('completed');
  });

  it('ignores failed payment payloads', () => {
    const rawBody = paymentPayload({ status: 'FAILED', amount_money: { amount: 1500 } });
    const parsed = parseSquareSalesWebhook(rawBody, {
      'x-square-hmacsha256-signature': signBody(rawBody),
    });

    expect(parsed?.transactions).toEqual([]);
  });

  it('parses refund payloads as refunded ledger transactions', () => {
    const rawBody = JSON.stringify({
      event_id: 'evt-refund-1',
      type: 'refund.updated',
      merchant_id: 'merchant-1',
      data: {
        object: {
          refund: {
            id: 'refund-1',
            payment_id: 'pay-1',
            order_id: 'order-1',
            location_id: 'loc-1',
            status: 'COMPLETED',
            amount_money: { amount: 1500, currency: 'USD' },
          },
        },
      },
    });

    const parsed = parseSquareSalesWebhook(rawBody, {
      'x-square-hmacsha256-signature': signBody(rawBody),
    });

    expect(parsed?.transactions).toHaveLength(1);
    expect(parsed?.transactions[0]).toMatchObject({
      externalTransactionId: 'refund-1',
      state: 'refunded',
      grossAmountCents: 1500,
      platformFeeCents: 0,
    });
  });

  it('handles malformed JSON bodies gracefully', () => {
    const parsed = parseSquareSalesWebhook('{not-json', {});
    expect(parsed).toBeNull();
  });
});
