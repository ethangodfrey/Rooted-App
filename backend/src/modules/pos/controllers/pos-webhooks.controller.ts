import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { PosProvider } from '@prisma/client';
import type { Request } from 'express';

import { PosWebhookService } from '../services/pos-webhook.service';

/**
 * Public webhook receiver. The raw body parser registered in main.ts ensures
 * `req.body` is a Buffer so provider signatures can be verified byte-for-byte.
 */
@Controller('pos/webhooks')
export class PosWebhooksController {
  constructor(private readonly webhooks: PosWebhookService) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(@Param('provider') providerParam: string, @Req() req: Request) {
    const provider = this.parseProvider(providerParam);
    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body ?? {});

    const headers = this.lowercaseHeaders(req.headers);
    const result = await this.webhooks.handleInbound({ provider, rawBody, headers });
    return { ok: result.accepted };
  }

  private parseProvider(value: string): PosProvider {
    const upper = value.toUpperCase();
    if (!(upper in PosProvider)) {
      throw new BadRequestException(`Unknown provider: ${value}`);
    }
    return upper as PosProvider;
  }

  private lowercaseHeaders(
    headers: Request['headers'],
  ): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(headers)) {
      out[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
    }
    return out;
  }
}
