import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { SquareIntegrationService } from '../services/square-integration.service';

/**
 * Canonical Square POS inventory webhook alias.
 * POST /api/webhooks/square
 *
 * Complements legacy POST /pos/webhooks/square (sync queue) with a direct
 * marketplace stock deduction path for inventory.count.updated / order.created.
 */
@Controller('api/webhooks/square')
export class ApiSquareWebhooksController {
  constructor(private readonly square: SquareIntegrationService) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});

    return this.square.handleInboundWebhook(rawBody, headers);
  }
}
