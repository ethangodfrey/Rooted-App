import {
  formatPaymentWebhooksActiveLog,
  formatStripeGatewayInitializedLog,
  normalizeCheckoutAmountCents,
  normalizePaymentReferenceType,
} from './payments-gateway.util';

describe('formatStripeGatewayInitializedLog', () => {
  it('returns the gateway telemetry prefix', () => {
    expect(formatStripeGatewayInitializedLog()).toBe(
      'STRIPE_GATEWAY_INITIALIZED SERVICE=StripeService',
    );
  });
});

describe('formatPaymentWebhooksActiveLog', () => {
  it('returns the base webhook telemetry prefix', () => {
    expect(formatPaymentWebhooksActiveLog()).toBe('PAYMENT_WEBHOOKS_ACTIVE');
  });

  it('includes optional event type and reference id fields', () => {
    expect(
      formatPaymentWebhooksActiveLog({
        eventType: 'checkout.session.completed',
        referenceId: 'ref-123',
      }),
    ).toBe('PAYMENT_WEBHOOKS_ACTIVE EVENT=checkout.session.completed REF=ref-123');
  });
});

describe('normalizePaymentReferenceType', () => {
  it('returns null for empty or unknown values', () => {
    expect(normalizePaymentReferenceType(undefined)).toBeNull();
    expect(normalizePaymentReferenceType(null)).toBeNull();
    expect(normalizePaymentReferenceType('')).toBeNull();
    expect(normalizePaymentReferenceType('   ')).toBeNull();
    expect(normalizePaymentReferenceType('ORDER')).toBeNull();
  });

  it('normalizes catering aliases', () => {
    expect(normalizePaymentReferenceType('catering')).toBe('CATERING');
    expect(normalizePaymentReferenceType('CATERING_INQUIRY')).toBe('CATERING');
  });

  it('normalizes procurement aliases', () => {
    expect(normalizePaymentReferenceType('procurement')).toBe('B2B_PROCUREMENT');
    expect(normalizePaymentReferenceType('WHOLESALE')).toBe('B2B_PROCUREMENT');
    expect(normalizePaymentReferenceType('B2B_PROCUREMENT')).toBe('B2B_PROCUREMENT');
  });
});

describe('normalizeCheckoutAmountCents', () => {
  it('accepts integer cent amounts at or above the Stripe minimum', () => {
    expect(normalizeCheckoutAmountCents(50)).toBe(50);
    expect(normalizeCheckoutAmountCents(1800)).toBe(1800);
    expect(normalizeCheckoutAmountCents(99.9)).toBe(99);
  });

  it('rejects amounts below the minimum or non-finite values', () => {
    expect(() => normalizeCheckoutAmountCents(49)).toThrow('AMOUNT_INVALID');
    expect(() => normalizeCheckoutAmountCents(0)).toThrow('AMOUNT_INVALID');
    expect(() => normalizeCheckoutAmountCents(-100)).toThrow('AMOUNT_INVALID');
    expect(() => normalizeCheckoutAmountCents(Number.NaN)).toThrow('AMOUNT_INVALID');
    expect(() => normalizeCheckoutAmountCents(Number.POSITIVE_INFINITY)).toThrow('AMOUNT_INVALID');
  });
});
