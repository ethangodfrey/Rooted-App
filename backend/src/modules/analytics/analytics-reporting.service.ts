import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  buildEngagementTotals,
  formatAnalyticsDashboardInitializedLog,
  formatMetricsSyncCompleteLog,
  mergeMetricRows,
  normalizeEntityType,
  normalizeMetricType,
  seriesForMetric,
  toDateKey,
  type EngagementEntityType,
  type EngagementMetricRow,
  type EngagementMetricType,
  type EngagementSeriesPoint,
  type EngagementSummaryTotals,
} from './analytics.util';

export type AnalyticsSummaryResult = {
  STATUS: 'METRICS_SYNC_COMPLETE';
  ENTITY_ID: string;
  ENTITY_TYPE: EngagementEntityType;
  DAYS: number;
  TOTALS: EngagementSummaryTotals;
  SERIES: {
    POST_REACH: EngagementSeriesPoint[];
    INQUIRIES: EngagementSeriesPoint[];
    RSVPS: EngagementSeriesPoint[];
  };
  POSTS: {
    COUNT: number;
    PARTNERSHIP_COUNT: number;
    VIEW_COUNT: number;
    CLICK_COUNT: number;
  };
  CATERING: {
    INQUIRY_COUNT: number;
    OPEN_COUNT: number;
  };
  COLLABORATIONS: {
    COUNT: number;
  };
};

@Injectable()
export class AnalyticsReportingService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatAnalyticsDashboardInitializedLog());
  }

  async getSummary(input: {
    userId: string;
    vendorId?: string | null;
    role?: string | null;
    days?: number;
  }): Promise<AnalyticsSummaryResult> {
    const days = Math.min(90, Math.max(1, Math.floor(input.days ?? 30)));
    const entityType = normalizeEntityType(
      input.role === 'farmer' ? 'FARMER' : 'VENDOR',
    );
    const entityId = input.vendorId?.trim() || input.userId;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceKey = toDateKey(since);

    const [storedRows, postStats, cateringStats, collabCount, rsvpRows] =
      await Promise.all([
        this.loadStoredMetrics(entityId, entityType, sinceKey),
        this.loadPostStats(input.userId, input.vendorId ?? null),
        this.loadCateringStats(input.vendorId ?? null, sinceKey),
        this.loadCollaborationCount(input.userId, input.vendorId ?? null),
        this.loadRsvpBackfill(input.vendorId ?? null, input.userId, sinceKey),
      ]);

    const inquiryBackfill: EngagementMetricRow[] =
      cateringStats.dailyInquiries.map((row) => ({
        metricDate: row.date,
        metricType: 'INQUIRY' as const,
        count: row.count,
      }));

    const viewBackfill: EngagementMetricRow[] = [
      {
        metricDate: toDateKey(new Date()),
        metricType: 'VIEW',
        count: postStats.viewCount,
      },
    ];

    const merged = mergeMetricRows(
      storedRows,
      inquiryBackfill,
      rsvpRows,
      viewBackfill.filter((r) => r.count > 0),
    );

    const totals = buildEngagementTotals(merged, collabCount);
    // Prefer live post reach counters when present.
    if (postStats.viewCount + postStats.clickCount > totals.postReach) {
      totals.postReach = postStats.viewCount + postStats.clickCount;
      totals.views = Math.max(totals.views, postStats.viewCount);
    }
    if (cateringStats.inquiryCount > totals.inquiries) {
      totals.inquiries = cateringStats.inquiryCount;
    }

    this.logger.log(
      formatMetricsSyncCompleteLog({
        entityId,
        days,
        total: totals.views + totals.inquiries + totals.rsvps,
      }),
    );

    return {
      STATUS: 'METRICS_SYNC_COMPLETE',
      ENTITY_ID: entityId,
      ENTITY_TYPE: entityType,
      DAYS: days,
      TOTALS: totals,
      SERIES: {
        POST_REACH: seriesForMetric(merged, 'VIEW', days),
        INQUIRIES: seriesForMetric(merged, 'INQUIRY', days),
        RSVPS: seriesForMetric(merged, 'RSVP', days),
      },
      POSTS: {
        COUNT: postStats.postCount,
        PARTNERSHIP_COUNT: postStats.partnershipCount,
        VIEW_COUNT: postStats.viewCount,
        CLICK_COUNT: postStats.clickCount,
      },
      CATERING: {
        INQUIRY_COUNT: cateringStats.inquiryCount,
        OPEN_COUNT: cateringStats.openCount,
      },
      COLLABORATIONS: {
        COUNT: collabCount,
      },
    };
  }

  async recordInteraction(input: {
    userId: string;
    vendorId?: string | null;
    role?: string | null;
    metricType: string;
    target: 'POST_CONTRIBUTION' | 'CATERING_INQUIRY' | 'ENTITY';
    targetId?: string | null;
    delta?: number;
  }): Promise<{ STATUS: string; METRIC_TYPE: EngagementMetricType }> {
    const metricType = normalizeMetricType(input.metricType);
    if (!metricType) {
      throw new BadRequestException('INVALID_METRIC_TYPE');
    }
    const entityType = normalizeEntityType(
      input.role === 'farmer' ? 'FARMER' : 'VENDOR',
    );
    const entityId = input.vendorId?.trim() || input.userId;
    const delta = Math.max(1, Math.floor(input.delta ?? 1));

    if (input.target === 'POST_CONTRIBUTION' && input.targetId) {
      await this.appendContributionInteraction(
        input.targetId,
        metricType,
        delta,
      );
    } else if (input.target === 'CATERING_INQUIRY' && input.targetId) {
      await this.appendCateringInteraction(input.targetId, metricType, delta);
    }

    await this.bumpMetric(entityId, entityType, metricType, delta);

    this.logger.log(
      formatMetricsSyncCompleteLog({
        entityId,
        days: 1,
        total: delta,
      }),
    );

    return { STATUS: 'METRICS_SYNC_COMPLETE', METRIC_TYPE: metricType };
  }

  private async bumpMetric(
    entityId: string,
    entityType: EngagementEntityType,
    metricType: EngagementMetricType,
    delta: number,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        SELECT public.bump_engagement_metric(
          ${entityId}::uuid,
          ${entityType}::public.engagement_entity_type,
          ${metricType}::public.engagement_metric_type,
          ${delta}::integer,
          (timezone('utc', now()))::date
        )
      `);
    } catch {
      // Soft-fail when phase73 not applied — summary still backfills from source tables.
      this.logger.warn(
        `METRICS_SYNC_COMPLETE DEGRADED ENTITY=${entityId} TYPE=${metricType}`,
      );
    }
  }

  private async appendContributionInteraction(
    contributionId: string,
    metricType: EngagementMetricType,
    delta: number,
  ): Promise<void> {
    const eventType = metricType === 'VIEW' ? 'VIEW' : metricType;
    const event = JSON.stringify({
      type: eventType,
      at: new Date().toISOString(),
      delta,
    });
    try {
      if (metricType === 'VIEW') {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE public.post_contributions
          SET
            interaction_events = COALESCE(interaction_events, '[]'::jsonb) || ${event}::jsonb,
            view_count = COALESCE(view_count, 0) + ${delta},
            last_interaction_at = NOW()
          WHERE id = ${contributionId}::uuid
        `);
      } else {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE public.post_contributions
          SET
            interaction_events = COALESCE(interaction_events, '[]'::jsonb) || ${event}::jsonb,
            last_interaction_at = NOW()
          WHERE id = ${contributionId}::uuid
        `);
      }
    } catch {
      // Columns may be missing until phase73 is applied.
    }
  }

  private async appendCateringInteraction(
    inquiryId: string,
    metricType: EngagementMetricType,
    delta: number,
  ): Promise<void> {
    const event = JSON.stringify({
      type: metricType,
      at: new Date().toISOString(),
      delta,
    });
    try {
      if (metricType === 'VIEW') {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE public.catering_inquiries
          SET
            interaction_events = COALESCE(interaction_events, '[]'::jsonb) || ${event}::jsonb,
            view_count = COALESCE(view_count, 0) + ${delta},
            last_interaction_at = NOW()
          WHERE id = ${inquiryId}::uuid
        `);
      } else {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE public.catering_inquiries
          SET
            interaction_events = COALESCE(interaction_events, '[]'::jsonb) || ${event}::jsonb,
            click_count = COALESCE(click_count, 0) + ${delta},
            last_interaction_at = NOW()
          WHERE id = ${inquiryId}::uuid
        `);
      }
    } catch {
      // Columns may be missing until phase73 is applied.
    }
  }

  private async loadStoredMetrics(
    entityId: string,
    entityType: EngagementEntityType,
    sinceKey: string,
  ): Promise<EngagementMetricRow[]> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          metric_date: Date | string;
          metric_type: string;
          count: number | string;
        }>
      >(Prisma.sql`
        SELECT metric_date, metric_type::text AS metric_type, count
        FROM public.engagement_metrics
        WHERE entity_id = ${entityId}::uuid
          AND entity_type = ${entityType}::public.engagement_entity_type
          AND metric_date >= ${sinceKey}::date
        ORDER BY metric_date ASC
      `);
      return rows
        .map((row) => {
          const metricType = normalizeMetricType(row.metric_type);
          if (!metricType) return null;
          return {
            metricDate: toDateKey(row.metric_date),
            metricType,
            count: Number(row.count) || 0,
          };
        })
        .filter((row): row is EngagementMetricRow => row != null);
    } catch {
      return [];
    }
  }

  private async loadPostStats(
    userId: string,
    vendorId: string | null,
  ): Promise<{
    postCount: number;
    partnershipCount: number;
    viewCount: number;
    clickCount: number;
  }> {
    try {
      const rows = vendorId
        ? await this.prisma.$queryRaw<
            Array<{
              post_count: number | string;
              partnership_count: number | string;
              view_count: number | string;
              click_count: number | string;
            }>
          >(Prisma.sql`
            SELECT
              COUNT(DISTINCT p.id)::int AS post_count,
              COUNT(DISTINCT p.id) FILTER (
                WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
              )::int AS partnership_count,
              COALESCE(SUM(c.view_count), 0)::int AS view_count,
              COALESCE(SUM(c.click_count), 0)::int AS click_count
            FROM public.posts p
            LEFT JOIN public.post_contributions c ON c.post_id = p.id
            WHERE p.vendor_id = ${vendorId}::uuid
               OR p.contributor_id = ${userId}::uuid
               OR p.partner_contributor_id = ${userId}::uuid
          `)
        : await this.prisma.$queryRaw<
            Array<{
              post_count: number | string;
              partnership_count: number | string;
              view_count: number | string;
              click_count: number | string;
            }>
          >(Prisma.sql`
            SELECT
              COUNT(DISTINCT p.id)::int AS post_count,
              COUNT(DISTINCT p.id) FILTER (
                WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
              )::int AS partnership_count,
              COALESCE(SUM(c.view_count), 0)::int AS view_count,
              COALESCE(SUM(c.click_count), 0)::int AS click_count
            FROM public.posts p
            LEFT JOIN public.post_contributions c ON c.post_id = p.id
            WHERE p.contributor_id = ${userId}::uuid
               OR p.partner_contributor_id = ${userId}::uuid
          `);
      return {
        postCount: Number(rows[0]?.post_count) || 0,
        partnershipCount: Number(rows[0]?.partnership_count) || 0,
        viewCount: Number(rows[0]?.view_count) || 0,
        clickCount: Number(rows[0]?.click_count) || 0,
      };
    } catch {
      return {
        postCount: 0,
        partnershipCount: 0,
        viewCount: 0,
        clickCount: 0,
      };
    }
  }

  private async loadCateringStats(
    vendorId: string | null,
    sinceKey: string,
  ): Promise<{
    inquiryCount: number;
    openCount: number;
    dailyInquiries: Array<{ date: string; count: number }>;
  }> {
    if (!vendorId) {
      return { inquiryCount: 0, openCount: 0, dailyInquiries: [] };
    }
    try {
      const totals = await this.prisma.$queryRaw<
        Array<{ inquiry_count: number | string; open_count: number | string }>
      >(Prisma.sql`
        SELECT
          COUNT(*)::int AS inquiry_count,
          COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_count
        FROM public.catering_inquiries
        WHERE vendor_id = ${vendorId}::uuid
          AND created_at >= ${sinceKey}::timestamptz
      `);

      const daily = await this.prisma.$queryRaw<
        Array<{ day: Date | string; count: number | string }>
      >(Prisma.sql`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS count
        FROM public.catering_inquiries
        WHERE vendor_id = ${vendorId}::uuid
          AND created_at >= ${sinceKey}::timestamptz
        GROUP BY 1
        ORDER BY 1
      `);

      return {
        inquiryCount: Number(totals[0]?.inquiry_count) || 0,
        openCount: Number(totals[0]?.open_count) || 0,
        dailyInquiries: daily.map((row) => ({
          date: toDateKey(row.day),
          count: Number(row.count) || 0,
        })),
      };
    } catch {
      return { inquiryCount: 0, openCount: 0, dailyInquiries: [] };
    }
  }

  private async loadCollaborationCount(
    userId: string,
    vendorId: string | null,
  ): Promise<number> {
    try {
      const rows = vendorId
        ? await this.prisma.$queryRaw<Array<{ count: number | string }>>(
            Prisma.sql`
              SELECT COUNT(*)::int AS count
              FROM public.posts p
              WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
                AND p.co_approval_status IN (
                  'APPROVED'::public.post_co_approval_status,
                  'APPENDED'::public.post_co_approval_status,
                  'PENDING'::public.post_co_approval_status
                )
                AND (
                  p.vendor_id = ${vendorId}::uuid
                  OR p.contributor_id = ${userId}::uuid
                  OR p.partner_contributor_id = ${userId}::uuid
                )
            `,
          )
        : await this.prisma.$queryRaw<Array<{ count: number | string }>>(
            Prisma.sql`
              SELECT COUNT(*)::int AS count
              FROM public.posts p
              WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
                AND p.co_approval_status IN (
                  'APPROVED'::public.post_co_approval_status,
                  'APPENDED'::public.post_co_approval_status,
                  'PENDING'::public.post_co_approval_status
                )
                AND (
                  p.contributor_id = ${userId}::uuid
                  OR p.partner_contributor_id = ${userId}::uuid
                )
            `,
          );
      return Number(rows[0]?.count) || 0;
    } catch {
      return 0;
    }
  }

  private async loadRsvpBackfill(
    vendorId: string | null,
    userId: string,
    sinceKey: string,
  ): Promise<EngagementMetricRow[]> {
    try {
      const rows = vendorId
        ? await this.prisma.$queryRaw<
            Array<{ day: Date | string; count: number | string }>
          >(Prisma.sql`
            SELECT (ue.created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS count
            FROM public.user_events ue
            INNER JOIN public.posts p ON p.id = ue.post_id
            WHERE ue.status = 'RSVP'
              AND ue.created_at >= ${sinceKey}::timestamptz
              AND (
                p.vendor_id = ${vendorId}::uuid
                OR p.contributor_id = ${userId}::uuid
                OR p.partner_contributor_id = ${userId}::uuid
              )
            GROUP BY 1
            ORDER BY 1
          `)
        : await this.prisma.$queryRaw<
            Array<{ day: Date | string; count: number | string }>
          >(Prisma.sql`
            SELECT (ue.created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS count
            FROM public.user_events ue
            INNER JOIN public.posts p ON p.id = ue.post_id
            WHERE ue.status = 'RSVP'
              AND ue.created_at >= ${sinceKey}::timestamptz
              AND (
                p.contributor_id = ${userId}::uuid
                OR p.partner_contributor_id = ${userId}::uuid
              )
            GROUP BY 1
            ORDER BY 1
          `);
      return rows.map((row) => ({
        metricDate: toDateKey(row.day),
        metricType: 'RSVP' as const,
        count: Number(row.count) || 0,
      }));
    } catch {
      return [];
    }
  }
}
