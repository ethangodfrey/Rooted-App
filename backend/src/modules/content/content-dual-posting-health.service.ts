import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CDN_SERVE_P95_BUDGET_MS,
  computeP95,
  formatCdnServeFailLog,
  formatDualPostingMetricCapturedLog,
  formatLatencyThresholdValidatedLog,
  isWithinBudget,
} from './content-dual-posting-metrics.util';

export type PostContributionsSyncHealth = {
  STATUS: 'OK' | 'DEGRADED';
  PENDING_WITHOUT_CREATE: number;
  ORPHAN_CONTRIBUTIONS: number;
  PARTNERSHIP_MISSING_PARTNER: number;
  CDN_SAMPLES: number;
  CDN_P95_MS: number;
  CDN_WITHIN_BUDGET: boolean;
};

/**
 * Validates post_contributions sync + optional CDN P95 samples.
 */
@Injectable()
export class ContentDualPostingHealthService {
  private readonly logger = new Logger(ContentDualPostingHealthService.name);
  private readonly cdnServeSamplesMs: number[] = [];

  constructor(private readonly prisma: PrismaService) {}

  recordCdnServeSample(serveMs: number): void {
    this.cdnServeSamplesMs.push(Math.max(0, serveMs));
    // Cap in-memory window to avoid unbounded growth.
    if (this.cdnServeSamplesMs.length > 500) {
      this.cdnServeSamplesMs.splice(0, this.cdnServeSamplesMs.length - 500);
    }
  }

  getCdnP95Ms(): number {
    return computeP95(this.cdnServeSamplesMs);
  }

  async validateSyncHealth(): Promise<PostContributionsSyncHealth> {
    const pendingWithoutCreate = await this.prisma.$queryRaw<
      Array<{ count: bigint }>
    >(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.posts p
      WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
        AND p.co_approval_status = 'PENDING'::public.post_co_approval_status
        AND NOT EXISTS (
          SELECT 1
          FROM public.post_contributions c
          WHERE c.post_id = p.id
            AND c.action = 'CREATE'
        )
    `);

    const orphanContributions = await this.prisma.$queryRaw<
      Array<{ count: bigint }>
    >(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.post_contributions c
      WHERE NOT EXISTS (
        SELECT 1 FROM public.posts p WHERE p.id = c.post_id
      )
    `);

    const partnershipMissingPartner = await this.prisma.$queryRaw<
      Array<{ count: bigint }>
    >(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.posts p
      WHERE p.posting_mode = 'PARTNERSHIP'::public.post_posting_mode
        AND p.partner_contributor_id IS NULL
    `);

    const pending = Number(pendingWithoutCreate[0]?.count ?? 0);
    const orphans = Number(orphanContributions[0]?.count ?? 0);
    const missingPartner = Number(partnershipMissingPartner[0]?.count ?? 0);
    const cdnP95 = this.getCdnP95Ms();
    const cdnWithin =
      this.cdnServeSamplesMs.length === 0 ||
      isWithinBudget(cdnP95, CDN_SERVE_P95_BUDGET_MS);

    const degraded = pending > 0 || orphans > 0 || missingPartner > 0 || !cdnWithin;
    const status: PostContributionsSyncHealth['STATUS'] = degraded
      ? 'DEGRADED'
      : 'OK';

    const health: PostContributionsSyncHealth = {
      STATUS: status,
      PENDING_WITHOUT_CREATE: pending,
      ORPHAN_CONTRIBUTIONS: orphans,
      PARTNERSHIP_MISSING_PARTNER: missingPartner,
      CDN_SAMPLES: this.cdnServeSamplesMs.length,
      CDN_P95_MS: Number(cdnP95.toFixed(2)),
      CDN_WITHIN_BUDGET: cdnWithin,
    };

    this.logger.log(
      formatDualPostingMetricCapturedLog({
        kind: 'SYNC_HEALTH',
        withinBudget: status === 'OK',
        p95Ms: cdnP95,
        detail: `STATUS=${status};PENDING_WITHOUT_CREATE=${pending};ORPHANS=${orphans};MISSING_PARTNER=${missingPartner}`,
      }),
    );

    this.logger.log(
      formatLatencyThresholdValidatedLog({
        kind: 'CDN_SERVE',
        valueMs: cdnP95,
        budgetMs: CDN_SERVE_P95_BUDGET_MS,
      }),
    );

    if (!cdnWithin && this.cdnServeSamplesMs.length > 0) {
      this.logger.error(formatCdnServeFailLog({ p95Ms: cdnP95 }));
    }

    return health;
  }
}
