/**
 * Invokes upsert_market_sales_snapshot() and merges tender breakdown columns.
 * @see docs/supabase/phase44_national_harvester_pos_analytics.sql
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PosSnapshotRollupJobData } from '../types/ledger-transaction';

@Injectable()
export class PosSnapshotRollupService {
  private readonly logger = new Logger(PosSnapshotRollupService.name);

  constructor(private readonly config: ConfigService) {}

  async rollupVendorMarketDay(job: PosSnapshotRollupJobData): Promise<string | null> {
    // TODO:
    // 1. supabase.rpc('upsert_market_sales_snapshot', { p_market_id, p_vendor_id, p_snapshot_date, ... })
    // 2. PATCH market_sales_snapshots payment_method_distribution + tender_breakdown
    this.logger.debug(
      `rollupVendorMarketDay scaffold: vendor=${job.vendorId} market=${job.marketId} date=${job.snapshotDate}`,
    );
    void this.config;
    return null;
  }
}
