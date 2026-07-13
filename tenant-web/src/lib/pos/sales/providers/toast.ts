/**
 * Toast sales webhook parser (scaffold).
 */

import type { ParsedSalesWebhook } from '../types';

export function parseToastSalesWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): ParsedSalesWebhook | null {
  // TODO: verify toast-signature via TOAST_WEBHOOK_SECRET
  void rawBody;
  void headers;

  return {
    provider: 'toast',
    providerEventId: 'unimplemented',
    eventType: 'order.unimplemented',
    signatureValid: false,
    transactions: [],
    rawPayload: {},
  };
}
