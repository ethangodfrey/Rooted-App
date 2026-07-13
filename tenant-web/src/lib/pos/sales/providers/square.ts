/**
 * Square sales webhook parser (scaffold).
 * @see backend/src/modules/pos/adapters/square/square.adapter.ts
 */

import type { ParsedSalesWebhook } from '../types';
import { isSalesWebhookEvent } from '../types';

export function parseSquareSalesWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): ParsedSalesWebhook | null {
  // TODO: verify x-square-hmacsha256-signature via SQUARE_WEBHOOK_SIGNATURE_KEY
  // TODO: map payment.* / order.* / refund.* → NormalizedLedgerTransaction[]
  void rawBody;
  void headers;

  return {
    provider: 'square',
    providerEventId: 'unimplemented',
    eventType: 'payment.unimplemented',
    signatureValid: false,
    transactions: [],
    rawPayload: {},
  };
}

export function isSquareSalesEvent(eventType: string): boolean {
  return isSalesWebhookEvent(eventType);
}
