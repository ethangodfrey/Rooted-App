import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  PosAnalyticsWebhookService,
  type PosAnalyticsWebhookPayload,
} from '../services/pos-analytics-webhook.service';

/**
 * Unified analytics webhook receiver.
 * POST /webhooks/pos/:provider  (provider = square | toast)
 *
 * Writes historical_sales_metrics and decrements product stock.
 * Distinct from legacy /pos/webhooks/:provider sync path.
 */
@Controller('webhooks/pos')
export class PosAnalyticsWebhooksController {
  constructor(private readonly analyticsWebhooks: PosAnalyticsWebhookService) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(
    @Param('provider') providerParam: string,
    @Req() req: Request,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const provider = this.analyticsWebhooks.parseProvider(providerParam);
    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});

    const normalized = this.lowercaseHeaders(headers);
    this.analyticsWebhooks.verifyRequest(provider, rawBody, normalized);

    const payload = this.parsePayload(rawBody);
    return this.analyticsWebhooks.process(provider, payload);
  }

  private parsePayload(rawBody: Buffer | string): PosAnalyticsWebhookPayload {
    try {
      const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const json = JSON.parse(text) as PosAnalyticsWebhookPayload;
      if (!json || typeof json !== 'object') {
        throw new Error('INVALID JSON OBJECT');
      }
      return json;
    } catch {
      throw new BadRequestException('INVALID WEBHOOK PAYLOAD');
    }
  }

  private lowercaseHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(headers)) {
      out[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
    }
    return out;
  }
}
