/**
 * AdminDashboardService — platform telemetry, global ledger, active fleet.
 * Telemetry: ADMIN_DASHBOARD_ACTIVE, SYSTEM_TELEMETRY_INITIALIZED
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import {
  computePlatformFeeCents,
  resolvePlatformFeeBps,
} from '../../common/settlement/platform-fee';
import { PrismaService } from '../../prisma/prisma.service';
import {
  clampAdminPage,
  clampAdminPageSize,
  formatAdminDashboardActiveLog,
  formatSystemTelemetryInitializedLog,
  normalizeAdminLedgerSortBy,
  normalizeAdminSortDir,
  parseAdminLedgerFilters,
  type AdminLedgerSortBy,
} from './admin-dashboard.util';

@Injectable()
export class AdminDashboardService implements OnModuleInit {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatSystemTelemetryInitializedLog());
    this.logger.log(formatAdminDashboardActiveLog());
  }

  private platformFeeBps(): number {
    return resolvePlatformFeeBps(
      this.config.get<string>('STRIPE_PLATFORM_FEE_BPS'),
    );
  }

  /**
   * Aggregate GMV (SETTLED), Active Escrow (HELD_IN_ESCROW),
   * and Total Platform Revenue (fee on settled net).
   */
  async getTelemetry() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        gmv_cents: number | string;
        escrow_cents: number | string;
        settled_net_cents: number | string;
        settled_count: number | string;
        escrow_count: number | string;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(amount_cents) FILTER (
          WHERE status = 'SETTLED'::public.financial_transaction_status
        ), 0) AS gmv_cents,
        COALESCE(SUM(amount_cents) FILTER (
          WHERE status = 'HELD_IN_ESCROW'::public.financial_transaction_status
        ), 0) AS escrow_cents,
        COALESCE(SUM(net_amount_cents) FILTER (
          WHERE status = 'SETTLED'::public.financial_transaction_status
        ), 0) AS settled_net_cents,
        COALESCE(COUNT(*) FILTER (
          WHERE status = 'SETTLED'::public.financial_transaction_status
        ), 0) AS settled_count,
        COALESCE(COUNT(*) FILTER (
          WHERE status = 'HELD_IN_ESCROW'::public.financial_transaction_status
        ), 0) AS escrow_count
      FROM public.financial_transactions
    `);

    const row = rows[0];
    const gmvCents = Number(row?.gmv_cents) || 0;
    const escrowCents = Number(row?.escrow_cents) || 0;
    const settledNetCents = Number(row?.settled_net_cents) || 0;
    const feeBps = this.platformFeeBps();
    const platformRevenueCents = computePlatformFeeCents(settledNetCents, feeBps);

    this.logger.log(
      formatAdminDashboardActiveLog({
        gmvCents,
        escrowCents,
      }),
    );
    this.logger.log(
      `SYSTEM_TELEMETRY_INITIALIZED GMV=${gmvCents} ESCROW=${escrowCents} REVENUE=${platformRevenueCents}`,
    );

    return {
      STATUS: 'SYSTEM_TELEMETRY_INITIALIZED',
      TOTAL_GMV_CENTS: gmvCents,
      ACTIVE_ESCROW_CENTS: escrowCents,
      PLATFORM_REVENUE_CENTS: platformRevenueCents,
      PLATFORM_FEE_BPS: feeBps,
      SETTLED_COUNT: Number(row?.settled_count) || 0,
      ESCROW_COUNT: Number(row?.escrow_count) || 0,
    };
  }

  /**
   * High-level view of all delivery_routes currently IN_TRANSIT.
   */
  async getActiveLogistics(limit = 50) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const routes = await this.prisma.$queryRaw<
      Array<{
        id: string;
        farmer_id: string;
        farm_name: string | null;
        dispatch_date: Date | string;
        status: string;
        created_at: Date;
        pending_stops: number | string;
        delivered_stops: number | string;
        total_stops: number | string;
      }>
    >(Prisma.sql`
      SELECT
        r.id,
        r.farmer_id,
        f.farm_name,
        r.dispatch_date,
        r.status::text AS status,
        r.created_at,
        COALESCE((
          SELECT COUNT(*)::int FROM public.delivery_stops s
          WHERE s.route_id = r.id AND s.status = 'PENDING'::public.delivery_stop_status
        ), 0) AS pending_stops,
        COALESCE((
          SELECT COUNT(*)::int FROM public.delivery_stops s
          WHERE s.route_id = r.id AND s.status = 'DELIVERED'::public.delivery_stop_status
        ), 0) AS delivered_stops,
        COALESCE((
          SELECT COUNT(*)::int FROM public.delivery_stops s
          WHERE s.route_id = r.id
        ), 0) AS total_stops
      FROM public.delivery_routes r
      JOIN public.farmers f ON f.id = r.farmer_id
      WHERE r.status = 'IN_TRANSIT'::public.delivery_route_status
      ORDER BY r.dispatch_date ASC, r.created_at DESC
      LIMIT ${safeLimit}
    `);

    this.logger.log(
      `ADMIN_DASHBOARD_ACTIVE FLEET_IN_TRANSIT=${routes.length}`,
    );

    return {
      STATUS: 'ADMIN_DASHBOARD_ACTIVE',
      COUNT: routes.length,
      ITEMS: routes.map((row) => ({
        id: row.id,
        farmerId: row.farmer_id,
        farmName: row.farm_name,
        dispatchDate:
          row.dispatch_date instanceof Date
            ? row.dispatch_date.toISOString().slice(0, 10)
            : String(row.dispatch_date).slice(0, 10),
        status: row.status,
        pendingStops: Number(row.pending_stops) || 0,
        deliveredStops: Number(row.delivered_stops) || 0,
        totalStops: Number(row.total_stops) || 0,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
      })),
    };
  }

  /**
   * Paginated global financial_transactions ledger.
   * Sortable by transaction_type and status.
   */
  async listLedger(input: {
    page?: number;
    pageSize?: number;
    status?: string;
    transactionType?: string;
    sortBy?: string;
    sortDir?: string;
  }) {
    const page = clampAdminPage(Number(input.page ?? 1));
    const pageSize = clampAdminPageSize(Number(input.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const filters = parseAdminLedgerFilters({
      status: input.status,
      transactionType: input.transactionType,
    });
    const sortBy = normalizeAdminLedgerSortBy(input.sortBy);
    const sortDir = normalizeAdminSortDir(input.sortDir);

    const whereParts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (filters.status) {
      whereParts.push(
        Prisma.sql`status = ${filters.status}::public.financial_transaction_status`,
      );
    }
    if (filters.transactionType) {
      whereParts.push(
        Prisma.sql`transaction_type = ${filters.transactionType}::public.financial_transaction_type`,
      );
    }
    const whereSql = Prisma.sql`${Prisma.join(whereParts, ' AND ')}`;
    const orderSql = this.ledgerOrderSql(sortBy, sortDir);

    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: number | string }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM public.financial_transactions
        WHERE ${whereSql}
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          source_id: string | null;
          destination_id: string | null;
          amount_cents: number | string;
          voucher_cents: number | string;
          net_amount_cents: number | string;
          status: string;
          transaction_type: string;
          reference_id: string | null;
          created_at: Date;
        }>
      >(Prisma.sql`
        SELECT
          id,
          source_id,
          destination_id,
          amount_cents,
          voucher_cents,
          net_amount_cents,
          status::text AS status,
          transaction_type::text AS transaction_type,
          reference_id,
          created_at
        FROM public.financial_transactions
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);

    const total = Number(countRows[0]?.count) || 0;
    this.logger.log(
      `ADMIN_DASHBOARD_ACTIVE LEDGER_PAGE=${page} COUNT=${rows.length} TOTAL=${total}`,
    );

    return {
      STATUS: 'ADMIN_DASHBOARD_ACTIVE',
      PAGE: page,
      PAGE_SIZE: pageSize,
      TOTAL: total,
      TOTAL_PAGES: Math.max(1, Math.ceil(total / pageSize)),
      SORT_BY: sortBy,
      SORT_DIR: sortDir,
      FILTER_STATUS: filters.status,
      FILTER_TYPE: filters.transactionType,
      ITEMS: rows.map((row) => ({
        id: row.id,
        sourceId: row.source_id,
        destinationId: row.destination_id,
        amountCents: Number(row.amount_cents) || 0,
        voucherCents: Number(row.voucher_cents) || 0,
        netAmountCents: Number(row.net_amount_cents) || 0,
        status: row.status,
        transactionType: row.transaction_type,
        referenceId: row.reference_id,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
      })),
    };
  }

  private ledgerOrderSql(
    sortBy: AdminLedgerSortBy,
    sortDir: 'asc' | 'desc',
  ): Prisma.Sql {
    // Whitelisted ORDER BY fragments only — never interpolate user strings.
    if (sortBy === 'transaction_type' && sortDir === 'asc') {
      return Prisma.sql`transaction_type ASC, created_at DESC`;
    }
    if (sortBy === 'transaction_type') {
      return Prisma.sql`transaction_type DESC, created_at DESC`;
    }
    if (sortBy === 'status' && sortDir === 'asc') {
      return Prisma.sql`status ASC, created_at DESC`;
    }
    if (sortBy === 'status') {
      return Prisma.sql`status DESC, created_at DESC`;
    }
    if (sortBy === 'amount_cents' && sortDir === 'asc') {
      return Prisma.sql`amount_cents ASC, created_at DESC`;
    }
    if (sortBy === 'amount_cents') {
      return Prisma.sql`amount_cents DESC, created_at DESC`;
    }
    if (sortDir === 'asc') {
      return Prisma.sql`created_at ASC`;
    }
    return Prisma.sql`created_at DESC`;
  }
}
