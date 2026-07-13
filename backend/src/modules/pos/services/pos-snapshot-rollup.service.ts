/**
 * Three-step PostgREST rollup lifecycle for market_sales_snapshots.
 * @see docs/supabase/phase44_national_harvester_pos_analytics.sql
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  aggregateTenderBreakdown,
  computeTenderDistribution,
  resolveTenderBreakdown,
} from '../utils/tender-aggregation';
import type {
  PaymentMethodDistribution,
  PosSnapshotRollupJobData,
  PosTransactionTenderRow,
  TenderBreakdown,
} from '../types/ledger-transaction';

interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

@Injectable()
export class PosSnapshotRollupService {
  private readonly logger = new Logger(PosSnapshotRollupService.name);

  constructor(private readonly config: ConfigService) {}

  private adminConfig(): SupabaseAdminConfig {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    if (!url || !serviceKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for market_sales_snapshots rollup',
      );
    }
    return { url: url.replace(/\/$/, ''), serviceKey };
  }

  private adminHeaders(admin: SupabaseAdminConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: admin.serviceKey,
      Authorization: `Bearer ${admin.serviceKey}`,
    };
  }

  private validateJob(job: PosSnapshotRollupJobData): void {
    if (!job.vendorId?.trim()) {
      throw new Error('rollupVendorMarketDay: vendorId is required');
    }
    if (!job.marketId?.trim()) {
      throw new Error('rollupVendorMarketDay: marketId is required');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(job.snapshotDate ?? '')) {
      throw new Error(`rollupVendorMarketDay: invalid snapshotDate "${job.snapshotDate}"`);
    }
  }

  /**
   * Step 1: RPC volume rollup
   * Step 2: Ledger tender scan for UTC day
   * Step 3: PATCH tender_breakdown + payment_method_distribution
   */
  async rollupVendorMarketDay(job: PosSnapshotRollupJobData): Promise<string | null> {
    this.validateJob(job);
    const admin = this.adminConfig();

    this.logger.debug(
      `rollup start vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate}`,
    );

    const snapshotId = await this.callUpsertMarketSalesSnapshot(admin, job);

    const dayRows = await this.fetchVendorTransactionsForDay(admin, job.vendorId, job.snapshotDate);
    const fromLedger = aggregateTenderBreakdown(dayRows);
    const tenderBreakdown = resolveTenderBreakdown(fromLedger, job.tenderBreakdown);
    const paymentMethodDistribution = computeTenderDistribution(tenderBreakdown);

    await this.patchSnapshotTenderMix(admin, {
      marketId: job.marketId,
      vendorId: job.vendorId,
      snapshotDate: job.snapshotDate,
      tenderBreakdown,
      paymentMethodDistribution,
    });

    this.logger.log(
      `rollup complete vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate} snapshot=${snapshotId ?? 'unknown'} tenders=${JSON.stringify(tenderBreakdown)}`,
    );

    return snapshotId;
  }

  /** Step 1 — POST /rest/v1/rpc/upsert_market_sales_snapshot */
  private async callUpsertMarketSalesSnapshot(
    admin: SupabaseAdminConfig,
    job: PosSnapshotRollupJobData,
  ): Promise<string | null> {
    const body = {
      p_market_id: job.marketId,
      p_vendor_id: job.vendorId,
      p_snapshot_date: job.snapshotDate,
      p_tenant_id: job.tenantId ?? null,
      p_pos_connection_id: job.posConnectionId ?? null,
      p_source: 'webhook',
    };

    const res = await fetch(`${admin.url}/rest/v1/rpc/upsert_market_sales_snapshot`, {
      method: 'POST',
      headers: {
        ...this.adminHeaders(admin),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(
        `Step 1 RPC failed vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate}: ${detail.slice(0, 400)}`,
      );
      throw new Error(`upsert_market_sales_snapshot failed: ${detail.slice(0, 300)}`);
    }

    const payload = (await res.json()) as string | string[] | null;
    const snapshotId = this.parseRpcUuid(payload);

    if (!snapshotId) {
      this.logger.warn(
        `Step 1 RPC returned no UUID vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate}`,
      );
    } else {
      this.logger.debug(`Step 1 RPC snapshotId=${snapshotId}`);
    }

    return snapshotId;
  }

  /** Step 2 — GET /rest/v1/pos_transactions for vendor + UTC day bounds */
  private async fetchVendorTransactionsForDay(
    admin: SupabaseAdminConfig,
    vendorId: string,
    snapshotDate: string,
  ): Promise<PosTransactionTenderRow[]> {
    const dayStart = `${snapshotDate}T00:00:00.000Z`;
    const nextDay = new Date(`${snapshotDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayEnd = nextDay.toISOString();

    const params = new URLSearchParams({
      vendor_id: `eq.${vendorId}`,
      sold_at: `gte.${dayStart}`,
      select: 'id,raw_payload',
      order: 'sold_at.asc',
    });
    params.append('sold_at', `lt.${dayEnd}`);

    const res = await fetch(`${admin.url}/rest/v1/pos_transactions?${params.toString()}`, {
      headers: this.adminHeaders(admin),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(
        `Step 2 ledger fetch failed vendor=${vendorId} date=${snapshotDate}: ${detail.slice(0, 400)}`,
      );
      throw new Error(`pos_transactions day fetch failed: ${detail.slice(0, 300)}`);
    }

    const rows = (await res.json()) as PosTransactionTenderRow[];
    this.logger.debug(
      `Step 2 fetched ${rows.length} pos_transactions vendor=${vendorId} date=${snapshotDate}`,
    );
    return rows;
  }

  /** Step 3 — PATCH /rest/v1/market_sales_snapshots tender JSON columns */
  private async patchSnapshotTenderMix(
    admin: SupabaseAdminConfig,
    input: {
      marketId: string;
      vendorId: string;
      snapshotDate: string;
      tenderBreakdown: TenderBreakdown;
      paymentMethodDistribution: PaymentMethodDistribution;
    },
  ): Promise<void> {
    const params = new URLSearchParams({
      market_id: `eq.${input.marketId}`,
      vendor_id: `eq.${input.vendorId}`,
      snapshot_date: `eq.${input.snapshotDate}`,
    });

    const res = await fetch(`${admin.url}/rest/v1/market_sales_snapshots?${params.toString()}`, {
      method: 'PATCH',
      headers: {
        ...this.adminHeaders(admin),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        tender_breakdown: input.tenderBreakdown,
        payment_method_distribution: input.paymentMethodDistribution,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(
        `Step 3 tender PATCH failed market=${input.marketId} vendor=${input.vendorId} date=${input.snapshotDate}: ${detail.slice(0, 400)}`,
      );
      throw new Error(`market_sales_snapshots tender patch failed: ${detail.slice(0, 300)}`);
    }

    this.logger.debug(
      `Step 3 patched tender mix market=${input.marketId} vendor=${input.vendorId} date=${input.snapshotDate}`,
    );
  }

  private parseRpcUuid(payload: string | string[] | null): string | null {
    if (typeof payload === 'string' && payload.length > 0) {
      return payload;
    }
    if (Array.isArray(payload) && typeof payload[0] === 'string') {
      return payload[0];
    }
    return null;
  }
}
