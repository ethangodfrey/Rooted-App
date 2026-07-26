/**
 * Square POS ↔ marketplace inventory bridge.
 * Logs: SQUARE_INTEGRATION_ACTIVE, INVENTORY_SYNCED
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

import { PrismaService } from '../../../prisma/prisma.service';
import { posProviderBaseUrl } from '../pos-public-url';
import {
  normalizeSquareEnvironment,
  squareAuthorizeBaseUrl,
} from '../square-environment';
import { PosConnectionService } from './pos-connection.service';

export type SquareInventoryDeductionResult = {
  STATUS: 'INVENTORY_SYNCED' | 'SQUARE_DEDUCT_MOCK' | 'SQUARE_DEDUCT_SKIPPED';
  VENDOR_ID: string;
  SKU: string;
  QUANTITY: number;
  MODE: 'LIVE' | 'MOCK' | 'SKIP';
  CATALOG_OBJECT_ID?: string;
  STOCK_AFTER?: number;
};

export type SquareWebhookSyncResult = {
  STATUS: 'INVENTORY_SYNCED' | 'SQUARE_WEBHOOK_IGNORED' | 'SQUARE_WEBHOOK_ACCEPTED';
  EVENT_TYPE: string;
  ITEMS: Array<{
    SKU: string;
    QUANTITY: number;
    STOCK_AFTER?: number;
  }>;
};

type ParsedSaleLine = {
  sku: string;
  quantity: number;
  catalogObjectId?: string;
};

@Injectable()
export class SquareIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(SquareIntegrationService.name);
  private readonly http: AxiosInstance;
  private readonly apiVersion: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly connections: PosConnectionService,
  ) {
    const environment = normalizeSquareEnvironment(
      this.config.get<string>('SQUARE_ENVIRONMENT', 'sandbox'),
    );
    this.apiVersion = this.config.get<string>('SQUARE_API_VERSION', '2024-12-18');
    this.http = axios.create({
      baseURL: squareAuthorizeBaseUrl(environment),
      timeout: 20_000,
      headers: { 'Square-Version': this.apiVersion },
    });
  }

  onModuleInit(): void {
    this.logger.log('SQUARE_INTEGRATION_ACTIVE');
  }

  /**
   * Reduce physical Square POS inventory for an online Stripe sale.
   * Uses Inventory API ADJUSTMENT (IN_STOCK → SOLD) when credentials exist;
   * otherwise logs a MOCK deduction so checkout is never blocked.
   */
  async deductSquareInventory(
    vendorId: string,
    sku: string,
    quantity: number,
  ): Promise<SquareInventoryDeductionResult> {
    const vendor = vendorId?.trim() ?? '';
    const skuKey = sku?.trim() ?? '';
    const qty = Math.max(0, Math.floor(Number(quantity) || 0));

    if (!vendor || !skuKey || qty < 1) {
      this.logger.warn(
        `SQUARE_DEDUCT_SKIPPED VENDOR=${vendor || 'NONE'} SKU=${skuKey || 'NONE'} QTY=${qty}`,
      );
      return {
        STATUS: 'SQUARE_DEDUCT_SKIPPED',
        VENDOR_ID: vendor,
        SKU: skuKey,
        QUANTITY: qty,
        MODE: 'SKIP',
      };
    }

    const catalogObjectId = await this.resolveCatalogObjectId(vendor, skuKey);
    const accessToken = await this.resolveAccessToken(vendor);
    const locationId = await this.resolveLocationId(vendor);

    if (!accessToken || !catalogObjectId || !locationId) {
      this.logger.log(
        `SQUARE_DEDUCT_MOCK VENDOR=${vendor} SKU=${skuKey} QTY=${qty} REASON=MISSING_LIVE_CREDENTIALS`,
      );
      const stockAfter = await this.deductLocalStock(vendor, skuKey, qty);
      if (stockAfter !== undefined) {
        this.logger.log(
          `INVENTORY_SYNCED VENDOR=${vendor} SKU=${skuKey} QTY=${qty} STOCK_AFTER=${stockAfter} SOURCE=ONLINE_MOCK`,
        );
      }
      return {
        STATUS: 'SQUARE_DEDUCT_MOCK',
        VENDOR_ID: vendor,
        SKU: skuKey,
        QUANTITY: qty,
        MODE: 'MOCK',
        CATALOG_OBJECT_ID: catalogObjectId,
        STOCK_AFTER: stockAfter,
      };
    }

    await this.http.post(
      '/v2/inventory/changes/batch-create',
      {
        idempotency_key: randomUUID(),
        changes: [
          {
            type: 'ADJUSTMENT',
            adjustment: {
              catalog_object_id: catalogObjectId,
              from_state: 'IN_STOCK',
              to_state: 'SOLD',
              location_id: locationId,
              quantity: String(qty),
              occurred_at: new Date().toISOString(),
            },
          },
        ],
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const stockAfter = await this.deductLocalStock(vendor, skuKey, qty);
    this.logger.log(
      `INVENTORY_SYNCED VENDOR=${vendor} SKU=${skuKey} QTY=${qty} STOCK_AFTER=${stockAfter ?? 'NA'} SOURCE=SQUARE_API`,
    );

    return {
      STATUS: 'INVENTORY_SYNCED',
      VENDOR_ID: vendor,
      SKU: skuKey,
      QUANTITY: qty,
      MODE: 'LIVE',
      CATALOG_OBJECT_ID: catalogObjectId,
      STOCK_AFTER: stockAfter,
    };
  }

  /**
   * Inbound Square POS webhook — inventory.count.updated / order.created.
   * Deducts digital marketplace stock so in-person sales cannot oversell online.
   */
  async handleInboundWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ): Promise<SquareWebhookSyncResult> {
    const raw = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    this.verifySignature(raw, headers);

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      throw new BadRequestException('INVALID_SQUARE_WEBHOOK_JSON');
    }

    const eventType = String(payload.type ?? 'unknown');
    const lines = this.extractSaleLines(payload, eventType);
    if (lines.length === 0) {
      this.logger.log(`SQUARE_WEBHOOK_IGNORED EVENT=${eventType}`);
      return { STATUS: 'SQUARE_WEBHOOK_IGNORED', EVENT_TYPE: eventType, ITEMS: [] };
    }

    const merchantId =
      typeof payload.merchant_id === 'string' ? payload.merchant_id : undefined;
    const vendorId = await this.resolveVendorIdFromMerchant(merchantId, payload);

    if (!vendorId) {
      this.logger.warn(`SQUARE_WEBHOOK_IGNORED EVENT=${eventType} REASON=NO_VENDOR`);
      return { STATUS: 'SQUARE_WEBHOOK_IGNORED', EVENT_TYPE: eventType, ITEMS: [] };
    }

    const items: SquareWebhookSyncResult['ITEMS'] = [];
    for (const line of lines) {
      const stockAfter = await this.deductLocalStock(vendorId, line.sku, line.quantity);
      if (stockAfter !== undefined) {
        this.logger.log(
          `INVENTORY_SYNCED VENDOR=${vendorId} SKU=${line.sku} QTY=${line.quantity} STOCK_AFTER=${stockAfter} SOURCE=SQUARE_WEBHOOK`,
        );
        items.push({
          SKU: line.sku,
          QUANTITY: line.quantity,
          STOCK_AFTER: stockAfter,
        });
      } else {
        this.logger.warn(
          `INVENTORY_SYNC_SKIPPED VENDOR=${vendorId} SKU=${line.sku} QTY=${line.quantity}`,
        );
        items.push({ SKU: line.sku, QUANTITY: line.quantity });
      }
    }

    return {
      STATUS: items.some((i) => i.STOCK_AFTER !== undefined)
        ? 'INVENTORY_SYNCED'
        : 'SQUARE_WEBHOOK_ACCEPTED',
      EVENT_TYPE: eventType,
      ITEMS: items,
    };
  }

  /** Best-effort: pull SKU lines from Stripe checkout session metadata. */
  extractCheckoutDeductionLines(metadata: Record<string, string> | null | undefined): Array<{
    vendorId: string;
    sku: string;
    quantity: number;
  }> {
    if (!metadata) return [];
    const vendorId = (metadata.vendor_id ?? metadata.VENDOR_ID ?? '').trim();
    const sku = (metadata.sku ?? metadata.SKU ?? '').trim();
    const quantity = Math.max(0, Math.floor(Number(metadata.quantity ?? metadata.QUANTITY) || 0));

    const lines: Array<{ vendorId: string; sku: string; quantity: number }> = [];
    if (vendorId && sku && quantity > 0) {
      lines.push({ vendorId, sku, quantity });
    }

    const packed = (metadata.square_inventory_lines ?? metadata.inventory_lines ?? '').trim();
    if (packed) {
      try {
        const parsed = JSON.parse(packed) as Array<{
          vendor_id?: string;
          vendorId?: string;
          sku?: string;
          quantity?: number;
        }>;
        if (Array.isArray(parsed)) {
          for (const row of parsed) {
            const v = String(row.vendor_id ?? row.vendorId ?? vendorId).trim();
            const s = String(row.sku ?? '').trim();
            const q = Math.max(0, Math.floor(Number(row.quantity) || 0));
            if (v && s && q > 0) lines.push({ vendorId: v, sku: s, quantity: q });
          }
        }
      } catch {
        /* ignore malformed packed lines */
      }
    }

    return lines;
  }

  private verifySignature(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): void {
    const normalized: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }

    const signatureKey = this.config
      .get<string>('SQUARE_WEBHOOK_SIGNATURE_KEY', '')
      .trim();
    const provided =
      normalized['x-square-hmacsha256-signature'] ??
      normalized['x-square-signature'] ??
      '';

    // Dev / CI: accept when no signature key is configured.
    if (!signatureKey) {
      this.logger.warn('SQUARE_WEBHOOK_VERIFY MODE=OPEN (NO_SIGNATURE_KEY)');
      return;
    }

    if (!provided) {
      throw new UnauthorizedException('SQUARE_WEBHOOK_INVALID_SIGNATURE');
    }

    const base = posProviderBaseUrl(this.config).replace(/\/$/, '');
    const candidateUrls = [
      `${base}/api/webhooks/square`,
      `${base}/pos/webhooks/square`,
    ];

    const ok = candidateUrls.some((notificationUrl) => {
      const expected = createHmac('sha256', signatureKey)
        .update(notificationUrl + rawBody)
        .digest('base64');
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });

    if (!ok) {
      throw new UnauthorizedException('SQUARE_WEBHOOK_INVALID_SIGNATURE');
    }
  }

  private extractSaleLines(
    payload: Record<string, unknown>,
    eventType: string,
  ): ParsedSaleLine[] {
    const type = eventType.toLowerCase();
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const object = (data.object ?? {}) as Record<string, unknown>;

    if (type === 'inventory.count.updated' || type.startsWith('inventory.')) {
      const counts = (object.inventory_counts ??
        object.inventoryCounts ??
        []) as Array<Record<string, unknown>>;
      const first = counts[0] ?? object;
      const catalogObjectId = String(
        first.catalog_object_id ?? first.catalogObjectId ?? object.catalog_object_id ?? '',
      );
      const sku = String(
        first.catalog_object_id ??
          first.sku ??
          object.sku ??
          catalogObjectId,
      ).trim();
      // Absolute count webhooks do not carry sold qty — use metadata.quantity_sold or 1.
      const meta = (payload.data as { metadata?: Record<string, unknown> } | undefined)?.metadata;
      const sold = Math.max(
        1,
        Math.floor(
          Number(
            (object as { quantity_sold?: unknown }).quantity_sold ??
              meta?.quantity_sold ??
              1,
          ) || 1,
        ),
      );
      if (!sku) return [];
      return [{ sku, quantity: sold, catalogObjectId: catalogObjectId || undefined }];
    }

    if (type === 'order.created' || type === 'order.updated' || type.startsWith('order.')) {
      const order =
        (object.order as Record<string, unknown> | undefined) ??
        object;
      const lineItems = (order.line_items ?? order.lineItems ?? []) as Array<
        Record<string, unknown>
      >;
      const parsed: ParsedSaleLine[] = [];
      for (const li of lineItems) {
        const catalogObjectId = String(
          li.catalog_object_id ?? li.catalogObjectId ?? '',
        ).trim();
        const sku = String(
          li.catalog_object_id ?? li.sku ?? li.name ?? catalogObjectId,
        ).trim();
        const quantity = Math.max(1, Math.floor(Number(li.quantity) || 1));
        if (!sku) continue;
        parsed.push({
          sku,
          quantity,
          ...(catalogObjectId ? { catalogObjectId } : {}),
        });
      }
      return parsed;
    }

    return [];
  }

  private async resolveVendorIdFromMerchant(
    merchantId: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<string | null> {
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const object = (data.object ?? {}) as Record<string, unknown>;
    const explicitVendor = String(
      object.vendor_id ?? data.vendor_id ?? payload.vendor_id ?? '',
    ).trim();
    if (explicitVendor) return explicitVendor;

    if (!merchantId) return null;

    const connection = await this.prisma.posConnection.findFirst({
      where: {
        provider: 'SQUARE',
        status: 'ACTIVE',
        providerMerchantId: merchantId,
      },
      select: { vendorId: true },
    });
    return connection?.vendorId ?? null;
  }

  private async resolveCatalogObjectId(
    vendorId: string,
    sku: string,
  ): Promise<string | undefined> {
    try {
      const byCatalog = await this.prisma.posProductMapping.findFirst({
        where: {
          providerCatalogObjectId: sku,
          connection: { vendorId, provider: 'SQUARE', status: 'ACTIVE' },
        },
        select: { providerCatalogObjectId: true },
      });
      if (byCatalog?.providerCatalogObjectId) {
        return byCatalog.providerCatalogObjectId;
      }
    } catch {
      /* mapping table may be unavailable in unit tests */
    }

    // products.sku may exist in SQL even when not on the Prisma Product model.
    try {
      const rows = await this.prisma.$queryRaw<Array<{ catalog_id: string | null }>>`
        select ppm.provider_catalog_object_id as catalog_id
        from public.products p
        join public.pos_product_mappings ppm on ppm.product_id = p.id
        join public.pos_connections pc on pc.id = ppm.connection_id
        where p.vendor_id = ${vendorId}::uuid
          and p.sku = ${sku}
          and pc.provider = 'SQUARE'
          and pc.status = 'ACTIVE'
        limit 1
      `;
      if (rows[0]?.catalog_id) return rows[0].catalog_id;
    } catch {
      /* sku column / mappings may be absent in some envs */
    }

    // Treat SKU as Square catalog object id when callers pass the catalog id directly.
    if (sku.length >= 8) {
      return sku;
    }
    return undefined;
  }

  private async resolveAccessToken(vendorId: string): Promise<string | undefined> {
    const connection = await this.prisma.posConnection.findFirst({
      where: { vendorId, provider: 'SQUARE', status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (connection) {
      try {
        const creds = await this.connections.getUsableCredentials(connection.id);
        if (creds.accessToken?.trim()) return creds.accessToken.trim();
      } catch (err) {
        this.logger.warn(
          `SQUARE_TOKEN_LOOKUP_FAILED VENDOR=${vendorId} ERR=${(err as Error).message}`,
        );
      }
    }

    const appToken = this.config.get<string>('SQUARE_ACCESS_TOKEN', '').trim();
    return appToken || undefined;
  }

  private async resolveLocationId(vendorId: string): Promise<string | undefined> {
    const connection = await this.prisma.posConnection.findFirst({
      where: { vendorId, provider: 'SQUARE', status: 'ACTIVE' },
      select: { providerLocationId: true },
      orderBy: { createdAt: 'desc' },
    });
    if (connection?.providerLocationId) return connection.providerLocationId;

    const envLocation = this.config.get<string>('SQUARE_LOCATION_ID', '').trim();
    return envLocation || undefined;
  }

  /**
   * Decrement products.stock when the column exists.
   * Returns stock_after, or undefined when the product/row cannot be updated.
   */
  private async deductLocalStock(
    vendorId: string,
    sku: string,
    quantity: number,
  ): Promise<number | undefined> {
    try {
      const bySku = await this.prisma.$queryRaw<Array<{ stock: number }>>`
        update public.products
        set stock = greatest(0, stock - ${quantity}), updated_at = now()
        where vendor_id = ${vendorId}::uuid
          and sku = ${sku}
          and stock is not null
        returning stock
      `;
      if (bySku[0] && typeof bySku[0].stock === 'number') {
        return Number(bySku[0].stock);
      }
    } catch {
      /* products.sku/stock may be missing */
    }

    try {
      const byCatalog = await this.prisma.$queryRaw<Array<{ stock: number }>>`
        update public.products p
        set stock = greatest(0, p.stock - ${quantity}), updated_at = now()
        from public.pos_product_mappings ppm
        join public.pos_connections pc on pc.id = ppm.connection_id
        where p.id = ppm.product_id
          and p.vendor_id = ${vendorId}::uuid
          and pc.provider = 'SQUARE'
          and ppm.provider_catalog_object_id = ${sku}
          and p.stock is not null
        returning p.stock
      `;
      if (byCatalog[0] && typeof byCatalog[0].stock === 'number') {
        return Number(byCatalog[0].stock);
      }
    } catch {
      /* mapping join may fail on schema drift */
    }

    return undefined;
  }
}
