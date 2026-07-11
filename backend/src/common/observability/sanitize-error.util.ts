import { HttpException, HttpStatus } from '@nestjs/common';

const WEBHOOK_PATH_PATTERN = /\/webhooks\/|\/stripe\/webhooks/;

export function isWebhookRequestPath(path: string | undefined): boolean {
  if (!path) return false;
  return WEBHOOK_PATH_PATTERN.test(path);
}

/** Maps internal failures to stable webhook response codes (no DB/stack leakage). */
export function webhookErrorCode(exception: unknown): string {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status === HttpStatus.BAD_REQUEST) return 'invalid_payload';
    if (status === HttpStatus.UNAUTHORIZED) return 'unauthorized';
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return 'service_unavailable';
    if (status < HttpStatus.INTERNAL_SERVER_ERROR) return 'rejected';
  }

  const message = exception instanceof Error ? exception.message.toLowerCase() : '';
  if (message.includes('signature') || message.includes('stripe-signature')) {
    return 'invalid_signature';
  }
  if (message.includes('webhook secret')) {
    return 'webhook_not_configured';
  }

  return 'processing_failed';
}

/** Sanitized text safe for webhook audit tables and external HTTP bodies. */
export function sanitizeWebhookErrorMessage(exception: unknown): string {
  return webhookErrorCode(exception);
}

/** Public JSON envelope for webhook endpoints. */
export function webhookErrorResponse(
  exception: unknown,
  requestId?: string,
): Record<string, unknown> {
  return {
    ok: false,
    error: webhookErrorCode(exception),
    requestId,
    timestamp: new Date().toISOString(),
  };
}
