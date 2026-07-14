/**
 * Upserts processed financial rows into public.analytics_sales (Phase 45).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AnalyticsSaleInsert } from '../types/ledger-transaction';

interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

@Injectable()
export class PosAnalyticsSalesService {
  private readonly logger = new Logger(PosAnalyticsSalesService.name);

  constructor(private readonly config: ConfigService) {}

  private adminConfig(): SupabaseAdminConfig | null {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
  }

  async upsertSale(row: AnalyticsSaleInsert): Promise<{ id: string } | null> {
    const admin = this.adminConfig();
    if (!admin) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for analytics_sales writes',
      );
    }

    const gross = Math.max(0, Math.trunc(row.grossSalesCents));
    const tax = Math.max(0, Math.trunc(row.taxCents ?? 0));
    const processingFee = Math.max(0, Math.trunc(row.processingFeeCents ?? 0));
    const platformFee = Math.max(0, Math.trunc(row.platformFeeCents));
    const net = Math.max(0, gross - tax - processingFee - platformFee);

    const body = {
      vendor_id: row.vendorId,
      tenant_id: row.tenantId ?? null,
      connection_id: row.connectionId ?? null,
      webhook_log_id: row.webhookLogId ?? null,
      provider: row.provider,
      external_transaction_id: row.externalTransactionId,
      provider_location_id: row.providerLocationId ?? null,
      provider_order_id: row.providerOrderId ?? null,
      status: row.status,
      currency: row.currency || 'USD',
      gross_sales_cents: gross,
      tax_cents: tax,
      processing_fee_cents: processingFee,
      platform_fee_cents: platformFee,
      net_sales_cents: net,
      tender_type: row.tenderType ?? null,
      sold_at: row.soldAt,
      metadata: row.metadata ?? {},
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(
      `${admin.url}/rest/v1/analytics_sales?on_conflict=provider,external_transaction_id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: admin.serviceKey,
          Authorization: `Bearer ${admin.serviceKey}`,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(
        `analytics_sales upsert failed (${row.provider}:${row.externalTransactionId}): ${detail.slice(0, 400)}`,
      );
      throw new Error(`analytics_sales upsert failed: ${detail.slice(0, 300)}`);
    }

    const rows = (await res.json()) as Array<{ id: string }>;
    const id = rows[0]?.id;
    if (!id) {
      this.logger.warn(
        `analytics_sales upsert returned no row for ${row.provider}:${row.externalTransactionId}`,
      );
      return null;
    }

    this.logger.log(
      `analytics_sales upserted ${row.provider}:${row.externalTransactionId} → ${id}`,
    );
    return { id };
  }
}
