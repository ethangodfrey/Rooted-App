/**
 * Clover sales webhook parser (scaffold).
 */

import type { ParsedSalesWebhook } from '../types';

export function parseCloverSalesWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): ParsedSalesWebhook | null {
  // TODO: verify Clover webhook signature via CLOVER_WEBHOOK_SECRET
  void rawBody;
  void headers;

  return {
    provider: 'clover',
    providerEventId: 'unimplemented',
    eventType: 'PAYMENT.unimplemented',
    signatureValid: false,
    transactions: [],
    rawPayload: {},
  };
}
