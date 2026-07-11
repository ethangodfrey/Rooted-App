import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

import {
  isWebhookRequestPath,
  sanitizeWebhookErrorMessage,
  webhookErrorCode,
} from './sanitize-error.util';

describe('sanitize-error.util', () => {
  it('detects webhook request paths', () => {
    expect(isWebhookRequestPath('/webhooks/stripe')).toBe(true);
    expect(isWebhookRequestPath('/api/webhooks/stripe')).toBe(true);
    expect(isWebhookRequestPath('/stripe/webhooks')).toBe(true);
    expect(isWebhookRequestPath('/checkout')).toBe(false);
  });

  it('maps exceptions to stable webhook error codes', () => {
    expect(webhookErrorCode(new BadRequestException('bad'))).toBe('invalid_payload');
    expect(webhookErrorCode(new ServiceUnavailableException('secret'))).toBe('service_unavailable');
    expect(webhookErrorCode(new Error('No signatures found matching the expected signature'))).toBe(
      'invalid_signature',
    );
  });

  it('sanitizes stored webhook audit messages', () => {
    expect(sanitizeWebhookErrorMessage(new Error('relation "orders" does not exist'))).toBe(
      'processing_failed',
    );
  });
});
