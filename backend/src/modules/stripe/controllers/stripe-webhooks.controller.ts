import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { StripeService } from '../stripe.service';

/**
 * Public Stripe webhook receiver. Raw body parser in main.ts ensures signature
 * verification works byte-for-byte (same pattern as POS webhooks).
 */
@Controller('stripe/webhooks')
export class StripeWebhooksController {
  constructor(private readonly stripe: StripeService) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request) {
    if (!this.stripe.isConfigured()) {
      return { ok: false, reason: 'stripe_not_configured' };
    }

    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body ?? {});

    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe-Signature header.');
    }

    const event = this.stripe.verifyWebhook(rawBody, signature);
    await this.stripe.handleWebhookEvent(event);
    return { ok: true, type: event.type };
  }
}
