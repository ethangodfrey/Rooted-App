import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  averageDailyRate,
  detectAnomaly,
  formatAnomalyDetectionActiveLog,
  formatAnomalySummaryText,
  formatPerformanceAnomalyDetectedLog,
  type AnomalyFinding,
  type IntelligenceMetricType,
} from './intelligence.util';
import {
  PartnerReportService,
  type PartnerEntity,
} from './partner-report.service';

@Injectable()
export class PerformanceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: PartnerReportService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatAnomalyDetectionActiveLog());
  }

  async scanAllPartners(): Promise<{
    STATUS: string;
    SCANNED: number;
    ANOMALIES: number;
  }> {
    const entities = await this.reports.listPartnerEntities();
    let anomalies = 0;

    for (const entity of entities) {
      const findings = await this.detectForEntity(entity);
      for (const finding of findings) {
        anomalies += 1;
        this.logger.log(
          formatPerformanceAnomalyDetectedLog({
            entityId: entity.entityId,
            metricType: finding.metricType,
            direction: finding.direction,
            changePct: finding.changePct,
          }),
        );
        await this.reports.storeAnomalyReport({
          entity,
          summaryText: formatAnomalySummaryText({
            entityLabel: entity.label,
            finding,
          }),
          metrics: {
            finding,
            windowDays: 30,
            currentWindowDays: 1,
          },
        });
      }
    }

    this.logger.log(
      `ANOMALY_DETECTION_ACTIVE ACTION=SCAN_COMPLETE SCANNED=${entities.length} ANOMALIES=${anomalies}`,
    );
    return {
      STATUS: 'ANOMALY_DETECTION_ACTIVE',
      SCANNED: entities.length,
      ANOMALIES: anomalies,
    };
  }

  async detectForEntity(entity: PartnerEntity): Promise<AnomalyFinding[]> {
    const metrics: IntelligenceMetricType[] = ['VIEW', 'INQUIRY', 'RSVP'];
    const findings: AnomalyFinding[] = [];

    for (const metricType of metrics) {
      const { currentTotal, baselineTotal } = await this.loadWindowTotals(
        entity.entityId,
        metricType,
      );
      const currentRate = averageDailyRate(currentTotal, 1);
      const baselineRate = averageDailyRate(baselineTotal, 30);
      const finding = detectAnomaly({
        metricType,
        currentRate,
        baselineRate,
      });
      if (finding) findings.push(finding);
    }

    return findings;
  }

  private async loadWindowTotals(
    entityId: string,
    metricType: IntelligenceMetricType,
  ): Promise<{ currentTotal: number; baselineTotal: number }> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ bucket: string; total: number | string }>
      >(Prisma.sql`
        SELECT
          CASE
            WHEN metric_date = (timezone('utc', now()))::date THEN 'current'
            ELSE 'baseline'
          END AS bucket,
          COALESCE(SUM(count), 0)::int AS total
        FROM public.engagement_metrics
        WHERE entity_id = ${entityId}::uuid
          AND metric_type = ${metricType}::public.engagement_metric_type
          AND metric_date >= (timezone('utc', now()))::date - 30
          AND metric_date <= (timezone('utc', now()))::date
        GROUP BY 1
      `);

      let currentTotal = 0;
      let baselineTotal = 0;
      for (const row of rows) {
        const n = Number(row.total) || 0;
        if (row.bucket === 'current') currentTotal = n;
        else baselineTotal += n;
      }
      return { currentTotal, baselineTotal };
    } catch {
      return { currentTotal: 0, baselineTotal: 0 };
    }
  }
}
