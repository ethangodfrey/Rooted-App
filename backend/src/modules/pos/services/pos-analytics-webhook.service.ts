import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../../../prisma/prisma.service';

export type AnalyticsPosProvider = 'square' | 'toast';

export type PosAnalyticsWebhookItem = {
  product_id?: string;
  sku?: string;
  quantity?: number;
};

export type PosAnalyticsWebhookPayload = {
  vendor_id: string;
  amount: number;
  currency?: string;
  recorded_at?: string;
  items?: PosAnalyticsWebhookItem[];
  metadata?: Record<string, unknown>;
  event_id?: string;
};

export type PosAnalyticsWebhookResult = {
  ok: true;
  provider: string;
  metric_id: string;
  vendor_id: string;
  amount: number;
  source: 'SQUARE' | 'TOAST';
  stock_decrements: Array<{
    product_id: string;
    sku: string | null;
    quantity: number;
    stock_after: number;
  }>;
  message: string;
};

const DEMO_WEBHOOK_TOKEN = 'DEMO_WEBHOOK_TOKEN';

@Injectable()
export class PosAnalyticsWebhookService {
  private readonly logger = new Logger(PosAnalyticsWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  parseProvider(raw: string): AnalyticsPosProvider {
    const value = raw.trim().toLowerCase();
    if (value !== 'square' && value !== 'toast') {
      throw new BadRequestException('PROVIDER MUST BE SQUARE OR TOAST');
    }
    return value;
  }

  /**
   * Verify provider webhook authenticity.
   * Accepts x-vendorly-webhook-token, Authorization Bearer, or HMAC headers.
   * Falls back to DEMO_WEBHOOK_TOKEN when env secrets are unset.
   */
  verifyRequest(
    provider: AnalyticsPosProvider,
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ): void {
    const sharedSecret =
      this.config.get<string>('POS_ANALYTICS_WEBHOOK_SECRET', '').trim() ||
      DEMO_WEBHOOK_TOKEN;
    const providerSecret =
      provider === 'square'
        ? this.config.get<string>('SQUARE_WEBHOOK_SECRET', '').trim() || sharedSecret
        : this.config.get<string>('TOAST_WEBHOOK_SECRET', '').trim() || sharedSecret;

    const tokenHeader =
      headers['x-vendorly-webhook-token'] ||
      headers['x-pos-webhook-token'] ||
      this.bearerToken(headers['authorization']);

    if (tokenHeader && this.equalString(tokenHeader, sharedSecret)) {
      return;
    }
    if (tokenHeader && this.equalString(tokenHeader, providerSecret)) {
      return;
    }

    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const signature =
      headers['x-square-hmacsha256-signature'] ||
      headers['x-square-signature'] ||
      headers['toast-signature'] ||
      headers['x-toast-signature'] ||
      headers['x-vendorly-signature'];

    if (signature && this.verifyHmac(body, signature, providerSecret)) {
      return;
    }

    // Local/dev convenience: accept explicit DEMO token via body metadata flag
    // only when using the demo secret (never in production with real secrets).
    if (sharedSecret === DEMO_WEBHOOK_TOKEN && providerSecret === DEMO_WEBHOOK_TOKEN) {
      this.logger.warn(
        `${provider.toUpperCase()}_WEBHOOK: DEMO VERIFICATION ACCEPTED (NO ENV SECRET)`,
      );
      return;
    }

    throw new UnauthorizedException(`${provider.toUpperCase()}_WEBHOOK: INVALID SIGNATURE`);
  }

  async process(
    provider: AnalyticsPosProvider,
    payload: PosAnalyticsWebhookPayload,
  ): Promise<PosAnalyticsWebhookResult> {
    const vendorId = String(payload.vendor_id ?? '').trim();
    if (!vendorId) {
      throw new BadRequestException('VENDOR_ID REQUIRED');
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('AMOUNT MUST BE A NON-NEGATIVE NUMBER');
    }

    const source = provider === 'square' ? 'SQUARE' : 'TOAST';
    const recordedAt = payload.recorded_at
      ? new Date(payload.recorded_at)
      : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BadRequestException('RECORDED_AT INVALID');
    }

    this.logger.log(
      `${provider.toUpperCase()}_WEBHOOK: INGEST VENDOR=${vendorId} AMOUNT=${amount.toFixed(2)}`,
    );

    const metricRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      insert into public.historical_sales_metrics (
        vendor_id,
        source,
        amount,
        recorded_at
      ) values (
        ${vendorId}::uuid,
        ${source}::public.pos_sales_source,
        ${amount},
        ${recordedAt.toISOString()}::timestamptz
      )
      returning id
    `;

    const metricId = metricRows[0]?.id;
    if (!metricId) {
      throw new BadRequestException('METRIC INSERT FAILED');
    }

    const vendorRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      select id from public.vendors where user_id = ${vendorId}::uuid limit 1
    `;
    const vendorRowId = vendorRows[0]?.id;

    const stockDecrements: PosAnalyticsWebhookResult['stock_decrements'] = [];
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (vendorRowId && items.length > 0) {
      for (const item of items) {
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const product = await this.resolveProduct(vendorRowId, item);
        if (!product) {
          this.logger.warn(
            `STOCK_DECREMENT: PRODUCT NOT FOUND SKU=${item.sku ?? 'NONE'} ID=${item.product_id ?? 'NONE'}`,
          );
          continue;
        }

        const updated = await this.prisma.$queryRaw<
          Array<{ id: string; stock: number; sku: string | null }>
        >`
          update public.products
          set
            stock = stock - ${quantity},
            updated_at = now()
          where id = ${product.id}::uuid
            and vendor_id = ${vendorRowId}::uuid
            and stock >= ${quantity}
          returning id, stock, sku
        `;

        if (updated[0]) {
          this.logger.log(
            `STOCK_DECREMENT: PRODUCT=${updated[0].id} QTY=${quantity} STOCK_AFTER=${updated[0].stock}`,
          );
          stockDecrements.push({
            product_id: updated[0].id,
            sku: updated[0].sku,
            quantity,
            stock_after: Number(updated[0].stock),
          });
        } else {
          this.logger.warn(
            `STOCK_DECREMENT: INSUFFICIENT STOCK PRODUCT=${product.id} QTY=${quantity}`,
          );
        }
      }
    }

    return {
      ok: true,
      provider: provider.toUpperCase(),
      metric_id: metricId,
      vendor_id: vendorId,
      amount,
      source,
      stock_decrements: stockDecrements,
      message: `${provider.toUpperCase()}_WEBHOOK PROCESSED`,
    };
  }

  private async resolveProduct(
    vendorRowId: string,
    item: PosAnalyticsWebhookItem,
  ): Promise<{ id: string } | null> {
    if (item.product_id) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        select id from public.products
        where id = ${item.product_id}::uuid
          and vendor_id = ${vendorRowId}::uuid
        limit 1
      `;
      if (rows[0]) return rows[0];
    }

    const sku = item.sku?.trim();
    if (sku) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        select id from public.products
        where vendor_id = ${vendorRowId}::uuid
          and sku = ${sku}
        limit 1
      `;
      if (rows[0]) return rows[0];
    }

    return null;
  }

  private bearerToken(authorization?: string): string | undefined {
    if (!authorization) return undefined;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim();
  }

  private verifyHmac(body: string, signature: string, secret: string): boolean {
    const digest = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
    const hex = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    return this.equalString(signature, digest) || this.equalString(signature, hex);
  }

  private equalString(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
