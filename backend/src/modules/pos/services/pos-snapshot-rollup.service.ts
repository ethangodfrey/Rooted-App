/**
 * Invokes upsert_market_sales_snapshot() and merges tender breakdown columns.
 * @see docs/supabase/phase44_national_harvester_pos_analytics.sql
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  aggregateTenderBreakdown,
  computeTenderDistribution,
  mergeTenderBreakdown,
} from '../utils/tender-aggregation';
import type { PosSnapshotRollupJobData } from '../types/ledger-transaction';

interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

interface PosTransactionDayRow {
  id: string;
  raw_payload: Record<string, unknown>;
}

@Injectable()
export class PosSnapshotRollupService {
  private readonly logger = new Logger(PosSnapshotRollupService.name);

  constructor(private readonly config: ConfigService) {}

  private adminConfig(): SupabaseAdminConfig | null {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
  }

  private adminHeaders(admin: SupabaseAdminConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: admin.serviceKey,
      Authorization: `Bearer ${admin.serviceKey}`,
    };
  }

  /**
   * Rebuild vendor/market/day snapshot volumes via RPC, then patch tender mix columns.
   * Idempotent on (market_id, vendor_id, snapshot_date) via RPC upsert + safe JSON merge.
   */
  async rollupVendorMarketDay(job: PosSnapshotRollupJobData): Promise<string | null> {
    const admin = this.adminConfig();
    if (!admin) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for market_sales_snapshots rollup',
      );
    }

    const snapshotId = await this.callUpsertMarketSalesSnapshot(admin, job);
    if (!snapshotId) {
      this.logger.warn(
        `upsert_market_sales_snapshot returned no id for vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate}`,
      );
      return null;
    }

    const dayRows = await this.fetchVendorTransactionsForDay(
      admin,
      job.vendorId,
      job.snapshotDate,
    );
    const fromLedger = aggregateTenderBreakdown(dayRows);
    const tenderBreakdown = mergeTenderBreakdown(fromLedger, job.tenderBreakdown);
    const paymentMethodDistribution = computeTenderDistribution(tenderBreakdown);

    await this.patchSnapshotTenderMix(admin, {
      marketId: job.marketId,
      vendorId: job.vendorId,
      snapshotDate: job.snapshotDate,
      tenderBreakdown,
      paymentMethodDistribution,
    });

    this.logger.log(
      `market_sales_snapshots rollup vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate} → ${snapshotId}`,
    );

    return snapshotId;
  }

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
        `upsert_market_sales_snapshot failed (${job.vendorId}/${job.marketId}/${job.snapshotDate}): ${detail.slice(0, 400)}`,
      );
      throw new Error(`upsert_market_sales_snapshot failed: ${detail.slice(0, 300)}`);
    }

    const payload = (await res.json()) as string | string[] | null;
    if (typeof payload === 'string' && payload.length > 0) {
      return payload;
    }
    if (Array.isArray(payload) && typeof payload[0] === 'string') {
      return payload[0];
    }
    return null;
  }

  private async fetchVendorTransactionsForDay(
    admin: SupabaseAdminConfig,
    vendorId: string,
    snapshotDate: string,
  ): Promise<PosTransactionDayRow[]> {
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
      this.logger.warn(
        `pos_transactions day fetch failed for vendor=${vendorId} date=${snapshotDate}: ${detail.slice(0, 200)}`,
      );
      return [];
    }

    return (await res.json()) as PosTransactionDayRow[];
  }

  private async patchSnapshotTenderMix(
    admin: SupabaseAdminConfig,
    input: {
      marketId: string;
      vendorId: string;
      snapshotDate: string;
      tenderBreakdown: Record<string, number>;
      paymentMethodDistribution: Record<string, number>;
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
      throw new Error(`market_sales_snapshots tender patch failed: ${detail.slice(0, 300)}`);
    }
  }
}
