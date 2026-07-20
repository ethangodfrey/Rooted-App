import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  buildGrowthSummary,
  formatReportingEngineInitializedLog,
  formatWeeklySummaryText,
  resolvePreviousWeekRange,
  type GrowthSummary,
  type MetricTotals,
} from './intelligence.util';
import { PartnerNotifyService } from './partner-notify.service';

export type PartnerEntity = {
  entityId: string;
  entityType: 'FARMER' | 'VENDOR';
  userId: string;
  email: string | null;
  label: string;
};

@Injectable()
export class PartnerReportService implements OnModuleInit {
  private readonly logger = new Logger(PartnerReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: PartnerNotifyService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatReportingEngineInitializedLog());
  }

  async runWeeklyReports(asOf: Date = new Date()): Promise<{
    STATUS: string;
    GENERATED: number;
    SKIPPED: number;
  }> {
    const range = resolvePreviousWeekRange(asOf);
    const entities = await this.listPartnerEntities();
    let generated = 0;
    let skipped = 0;

    for (const entity of entities) {
      try {
        const created = await this.generateWeeklyReport(entity, range);
        if (created) generated += 1;
        else skipped += 1;
      } catch (err) {
        skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `REPORTING_ENGINE_INITIALIZED DEGRADED ENTITY=${entity.entityId} ERROR=${message}`,
        );
      }
    }

    this.logger.log(
      `REPORTING_ENGINE_INITIALIZED ACTION=WEEKLY_COMPLETE GENERATED=${generated} SKIPPED=${skipped}`,
    );
    return {
      STATUS: 'REPORTING_ENGINE_INITIALIZED',
      GENERATED: generated,
      SKIPPED: skipped,
    };
  }

  async listRecentReports(userId: string, limit = 20) {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          entity_id: string;
          entity_type: string;
          report_type: string;
          period_start: Date | string;
          period_end: Date | string;
          summary_text: string;
          metrics: unknown;
          email_status: string;
          created_at: Date;
        }>
      >(Prisma.sql`
        SELECT
          id, entity_id, entity_type, report_type,
          period_start, period_end, summary_text, metrics,
          email_status, created_at
        FROM public.partner_reports
        WHERE user_id = ${userId}::uuid
        ORDER BY created_at DESC
        LIMIT ${Math.min(50, Math.max(1, limit))}
      `);
      return rows.map((row) => ({
        id: row.id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        reportType: row.report_type,
        periodStart: String(row.period_start).slice(0, 10),
        periodEnd: String(row.period_end).slice(0, 10),
        summaryText: row.summary_text,
        metrics: row.metrics,
        emailStatus: row.email_status,
        createdAt: row.created_at,
      }));
    } catch {
      return [];
    }
  }

  async generateWeeklyReport(
    entity: PartnerEntity,
    range: ReturnType<typeof resolvePreviousWeekRange>,
  ): Promise<boolean> {
    const current = await this.sumMetrics(
      entity.entityId,
      range.periodStart,
      range.periodEnd,
    );
    const previous = await this.sumMetrics(
      entity.entityId,
      range.priorStart,
      range.priorEnd,
    );
    const growth = buildGrowthSummary(current, previous);
    const summaryText = formatWeeklySummaryText({
      entityLabel: entity.label,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      growth,
    });

    const metrics = {
      current,
      previous,
      growth,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
    };

    let reportId: string | null = null;
    try {
      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM public.partner_reports
        WHERE entity_id = ${entity.entityId}::uuid
          AND entity_type = ${entity.entityType}
          AND report_type = 'WEEKLY'
          AND period_start = ${range.periodStart}::date
          AND period_end = ${range.periodEnd}::date
        LIMIT 1
      `);
      if (existing[0]?.id) return false;

      const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO public.partner_reports (
          entity_id, entity_type, user_id,
          period_start, period_end, report_type,
          summary_text, metrics, email_to, email_status
        ) VALUES (
          ${entity.entityId}::uuid,
          ${entity.entityType},
          ${entity.userId}::uuid,
          ${range.periodStart}::date,
          ${range.periodEnd}::date,
          'WEEKLY',
          ${summaryText},
          ${JSON.stringify(metrics)}::jsonb,
          ${entity.email},
          'PENDING'
        )
        RETURNING id
      `);
      reportId = inserted[0]?.id ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `REPORTING_ENGINE_INITIALIZED STORE_FAILED ENTITY=${entity.entityId} ERROR=${message}`,
      );
      return false;
    }

    if (!reportId) return false;

    const notificationId = await this.notify.enqueueDashboardNotification({
      userId: entity.userId,
      title: 'PERFORMANCE_REPORT',
      body: summaryText.slice(0, 500),
      type: 'PERFORMANCE_REPORT',
    });

    const emailStatus = await this.notify.sendPartnerEmail({
      to: entity.email ?? '',
      subject: `Vendorly weekly performance — ${entity.label}`,
      text: summaryText,
    });

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.partner_reports
      SET
        email_status = ${emailStatus},
        email_sent_at = CASE WHEN ${emailStatus} = 'SENT' THEN NOW() ELSE email_sent_at END,
        notification_id = COALESCE(${notificationId}::uuid, notification_id),
        updated_at = NOW()
      WHERE id = ${reportId}::uuid
    `);

    this.logger.log(
      `REPORTING_ENGINE_INITIALIZED ACTION=WEEKLY_STORED ENTITY=${entity.entityId} EMAIL=${emailStatus}`,
    );
    return true;
  }

  async storeAnomalyReport(input: {
    entity: PartnerEntity;
    summaryText: string;
    metrics: Record<string, unknown>;
  }): Promise<string | null> {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO public.partner_reports (
          entity_id, entity_type, user_id,
          period_start, period_end, report_type,
          summary_text, metrics, email_to, email_status
        ) VALUES (
          ${input.entity.entityId}::uuid,
          ${input.entity.entityType},
          ${input.entity.userId}::uuid,
          ${today}::date,
          ${today}::date,
          'ANOMALY',
          ${input.summaryText},
          ${JSON.stringify(input.metrics)}::jsonb,
          ${input.entity.email},
          'PENDING'
        )
        RETURNING id
      `);
      const reportId = inserted[0]?.id ?? null;
      if (!reportId) return null;

      const notificationId = await this.notify.enqueueDashboardNotification({
        userId: input.entity.userId,
        title: 'PERFORMANCE_ANOMALY',
        body: input.summaryText.slice(0, 500),
        type: 'PERFORMANCE_ANOMALY',
      });

      const emailStatus = await this.notify.sendPartnerEmail({
        to: input.entity.email ?? '',
        subject: `Vendorly performance alert — ${input.entity.label}`,
        text: input.summaryText,
      });

      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.partner_reports
        SET
          email_status = ${emailStatus},
          email_sent_at = CASE WHEN ${emailStatus} = 'SENT' THEN NOW() ELSE email_sent_at END,
          notification_id = COALESCE(${notificationId}::uuid, notification_id),
          updated_at = NOW()
        WHERE id = ${reportId}::uuid
      `);

      return reportId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `ANOMALY_DETECTION_ACTIVE STORE_FAILED ENTITY=${input.entity.entityId} ERROR=${message}`,
      );
      return null;
    }
  }

  async listPartnerEntities(): Promise<PartnerEntity[]> {
    try {
      const vendors = await this.prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          email: string | null;
          business_name: string | null;
        }>
      >(Prisma.sql`
        SELECT v.id, v.user_id, u.email, v.business_name
        FROM public.vendors v
        JOIN public.users u ON u.id = v.user_id
        WHERE v.approval_status = 'approved'
      `);

      const farmers = await this.prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          email: string | null;
          farm_name: string | null;
        }>
      >(Prisma.sql`
        SELECT f.id, f.user_id, u.email, f.farm_name
        FROM public.farmers f
        JOIN public.users u ON u.id = f.user_id
        WHERE f.approval_status = 'approved'
           OR f.approval_status = 'pending'
      `);

      const out: PartnerEntity[] = [
        ...vendors.map((v) => ({
          entityId: v.id,
          entityType: 'VENDOR' as const,
          userId: v.user_id,
          email: v.email,
          label: v.business_name?.trim() || 'Vendor',
        })),
        ...farmers.map((f) => ({
          entityId: f.id,
          entityType: 'FARMER' as const,
          userId: f.user_id,
          email: f.email,
          label: f.farm_name?.trim() || 'Farmer',
        })),
      ];
      return out;
    } catch {
      return [];
    }
  }

  private async sumMetrics(
    entityId: string,
    start: string,
    end: string,
  ): Promise<MetricTotals> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ metric_type: string; total: number | string }>
      >(Prisma.sql`
        SELECT metric_type::text AS metric_type, COALESCE(SUM(count), 0)::int AS total
        FROM public.engagement_metrics
        WHERE entity_id = ${entityId}::uuid
          AND metric_date >= ${start}::date
          AND metric_date <= ${end}::date
        GROUP BY metric_type
      `);
      const totals: MetricTotals = { views: 0, inquiries: 0, rsvps: 0 };
      for (const row of rows) {
        const n = Number(row.total) || 0;
        if (row.metric_type === 'VIEW') totals.views = n;
        if (row.metric_type === 'INQUIRY') totals.inquiries = n;
        if (row.metric_type === 'RSVP') totals.rsvps = n;
      }
      return totals;
    } catch {
      return { views: 0, inquiries: 0, rsvps: 0 };
    }
  }
}

export type { GrowthSummary };
