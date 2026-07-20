import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { buildCompressedMediaResult } from './content-media-cdn.util';
import { ContentDualPostingHealthService } from './content-dual-posting-health.service';
import {
  CDN_SERVE_P95_BUDGET_MS,
  CO_APPROVAL_LATENCY_BUDGET_MS,
  NOTIFY_TO_UI_LATENCY_BUDGET_MS,
  computeP95,
  elapsedMs,
  evaluateAssetOptimization,
  formatAssetThresholdFailLog,
  formatCdnServeFailLog,
  formatDualPostingMetricCapturedLog,
  formatLatencyThresholdValidatedLog,
  isWithinBudget,
  nowMs,
  notifyToUiLatencyMs,
} from './content-dual-posting-metrics.util';
import {
  assertDualAttribution,
  buildDualContributionMetadata,
  formatContentContributionSyncedLog,
  formatDualPostingInitializedLog,
  mapMediaKindToContentType,
  type ContributorType,
  type CreateDualContributionInput,
  type DualContentType,
  type DualContributionMetadata,
  type PostingMode,
} from './content-contribution.util';

export type CreateContributionResult = {
  POST_ID: string;
  METADATA: DualContributionMetadata;
  NOTIFIED_PARTNER: boolean;
  CDN_MEDIA_URL: string | null;
};

@Injectable()
export class ContentContributionService implements OnModuleInit {
  private readonly logger = new Logger(ContentContributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dualPostingHealth: ContentDualPostingHealthService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatDualPostingInitializedLog());
  }

  /**
   * Create a self or partnership post with dual-party attribution metadata.
   * Partnership posts start PENDING and notify the partner for co-approval/append.
   */
  async createContribution(input: {
    vendorId: string;
    authorId: string;
    authorType: ContributorType;
    postingMode: PostingMode;
    contentKind: 'text' | 'image' | 'video' | 'photo';
    caption: string;
    mediaUrl?: string | null;
    partnerId?: string | null;
    partnerType?: ContributorType | null;
    partnershipConnectionId?: string | null;
    postType?: string;
    mediaWidthPx?: number | null;
    mediaHeightPx?: number | null;
    mediaSizeBytes?: number | null;
  }): Promise<CreateContributionResult> {
    const contentType = mapMediaKindToContentType(input.contentKind);
    const media =
      input.mediaUrl && contentType !== 'TEXT'
        ? buildCompressedMediaResult({
            publicUrl: input.mediaUrl,
            kind: input.contentKind,
          })
        : {
            mediaUrl: null as string | null,
            cdnMediaUrl: null as string | null,
            mediaCompressed: false,
          };

    if (media.cdnMediaUrl) {
      await this.captureCdnServeMetric({
        postId: null,
        cdnUrl: media.cdnMediaUrl,
      });
    }

    this.captureAssetThresholdMetric({
      postId: null,
      kind: input.contentKind,
      widthPx: input.mediaWidthPx,
      heightPx: input.mediaHeightPx,
      sizeBytes: input.mediaSizeBytes,
    });

    const draft: CreateDualContributionInput = {
      authorId: input.authorId,
      authorType: input.authorType,
      contentType,
      postingMode: input.postingMode,
      partnerId: input.partnerId,
      partnerType: input.partnerType,
      partnershipConnectionId: input.partnershipConnectionId,
      mediaUrl: media.mediaUrl,
      cdnMediaUrl: media.cdnMediaUrl,
      mediaCompressed: media.mediaCompressed,
      caption: input.caption,
    };

    const metadata = buildDualContributionMetadata(draft);
    assertDualAttribution(metadata);

    const metadataForStore: DualContributionMetadata & { notifiedAt?: string } =
      input.postingMode === 'PARTNERSHIP'
        ? { ...metadata, notifiedAt: new Date().toISOString() }
        : metadata;

    const postId = await this.insertPost({
      vendorId: input.vendorId,
      caption: input.caption,
      postType: input.postType ?? 'announcement',
      contentType,
      metadata: metadataForStore,
      mediaUrl: media.mediaUrl,
      cdnMediaUrl: media.cdnMediaUrl,
      mediaCompressed: media.mediaCompressed,
    });

    await this.insertContributionRow({
      postId,
      contributorId: input.authorId,
      contributorType: input.authorType,
      contentType,
      body: input.caption,
      mediaUrl: media.mediaUrl,
      cdnMediaUrl: media.cdnMediaUrl,
      mediaCompressed: media.mediaCompressed,
      action: 'CREATE',
      metadata: metadataForStore,
    });

    const notified =
      metadata.postingMode === 'PARTNERSHIP' &&
      Boolean(metadata.parties.find((p) => p.role === 'PARTNER'));

    this.logger.log(
      formatContentContributionSyncedLog({
        postId,
        authorId: input.authorId,
        partnerId: input.partnerId,
        contentType,
        postingMode: input.postingMode,
      }),
    );

    return {
      POST_ID: postId,
      METADATA: metadataForStore,
      NOTIFIED_PARTNER: notified,
      CDN_MEDIA_URL: media.cdnMediaUrl,
    };
  }

  async coApproveOrAppend(input: {
    postId: string;
    partnerId: string;
    partnerType: ContributorType;
    action: 'CO_APPROVE' | 'APPEND' | 'REJECT';
    body?: string | null;
    mediaUrl?: string | null;
    contentKind?: 'text' | 'image' | 'video' | 'photo';
    mediaWidthPx?: number | null;
    mediaHeightPx?: number | null;
    mediaSizeBytes?: number | null;
  }): Promise<{ STATUS: string; METADATA: DualContributionMetadata }> {
    const started = nowMs();
    const contentType = mapMediaKindToContentType(input.contentKind ?? 'text');
    const media =
      input.mediaUrl && contentType !== 'TEXT'
        ? buildCompressedMediaResult({
            publicUrl: input.mediaUrl,
            kind: input.contentKind ?? 'image',
          })
        : {
            mediaUrl: null as string | null,
            cdnMediaUrl: null as string | null,
            mediaCompressed: false,
          };

    if (media.cdnMediaUrl) {
      await this.captureCdnServeMetric({
        postId: input.postId,
        cdnUrl: media.cdnMediaUrl,
      });
    }

    this.captureAssetThresholdMetric({
      postId: input.postId,
      kind: input.contentKind ?? 'text',
      widthPx: input.mediaWidthPx,
      heightPx: input.mediaHeightPx,
      sizeBytes: input.mediaSizeBytes,
    });

    const status =
      input.action === 'CO_APPROVE'
        ? 'APPROVED'
        : input.action === 'APPEND'
          ? 'APPENDED'
          : 'REJECTED';

    const notifyAnchor = await this.resolveNotifyAnchor(input.postId);

    await this.prisma.$executeRaw`
      UPDATE public.posts
      SET co_approval_status = ${status}::public.post_co_approval_status,
          contribution_metadata = contribution_metadata || ${JSON.stringify({
            lastPartnerAction: input.action,
            lastPartnerId: input.partnerId,
          })}::jsonb
      WHERE id = ${input.postId}::uuid
    `;

    await this.insertContributionRow({
      postId: input.postId,
      contributorId: input.partnerId,
      contributorType: input.partnerType,
      contentType,
      body: input.body ?? null,
      mediaUrl: media.mediaUrl,
      cdnMediaUrl: media.cdnMediaUrl,
      mediaCompressed: media.mediaCompressed,
      action: input.action,
      metadata: {
        parties: [
          {
            contributorId: input.partnerId,
            contributorType: input.partnerType,
            role: 'PARTNER',
          },
        ],
        postingMode: 'PARTNERSHIP',
        contentType,
        partnershipConnectionId: null,
        coApprovalStatus: status as DualContributionMetadata['coApprovalStatus'],
        mediaCompressed: media.mediaCompressed,
        cdnMediaUrl: media.cdnMediaUrl,
      },
    });

    const actionMs = elapsedMs(started);
    this.logger.log(
      formatDualPostingMetricCapturedLog({
        kind: 'CO_APPROVAL_LATENCY',
        postId: input.postId,
        valueMs: actionMs,
        withinBudget: isWithinBudget(actionMs, CO_APPROVAL_LATENCY_BUDGET_MS),
        detail: `ACTION=${input.action}`,
      }),
    );
    this.logger.log(
      formatLatencyThresholdValidatedLog({
        kind: 'CO_APPROVAL_LATENCY',
        postId: input.postId,
        valueMs: actionMs,
        budgetMs: CO_APPROVAL_LATENCY_BUDGET_MS,
      }),
    );

    if (notifyAnchor) {
      const notifyLatency = notifyToUiLatencyMs(notifyAnchor);
      this.logger.log(
        formatDualPostingMetricCapturedLog({
          kind: 'NOTIFY_TO_UI_LATENCY',
          postId: input.postId,
          valueMs: notifyLatency,
          withinBudget: isWithinBudget(
            notifyLatency,
            NOTIFY_TO_UI_LATENCY_BUDGET_MS,
          ),
          detail: 'PHASE=PARTNER_ACTION',
        }),
      );
      this.logger.log(
        formatLatencyThresholdValidatedLog({
          kind: 'NOTIFY_TO_UI_LATENCY',
          postId: input.postId,
          valueMs: notifyLatency,
          budgetMs: NOTIFY_TO_UI_LATENCY_BUDGET_MS,
        }),
      );
    }

    this.logger.log(
      `CONTENT_CONTRIBUTION_SYNCED POST=${input.postId} PARTNER=${input.partnerId} ACTION=${input.action}`,
    );

    return {
      STATUS: status,
      METADATA: {
        parties: [
          {
            contributorId: input.partnerId,
            contributorType: input.partnerType,
            role: 'PARTNER',
          },
        ],
        postingMode: 'PARTNERSHIP',
        contentType,
        partnershipConnectionId: null,
        coApprovalStatus: status as DualContributionMetadata['coApprovalStatus'],
        mediaCompressed: media.mediaCompressed,
        cdnMediaUrl: media.cdnMediaUrl,
      },
    };
  }

  /**
   * Partner UI receipt hook — latency from CONTENT_CONTRIBUTION notify to UI load.
   */
  async recordPartnerUiReceived(input: {
    postId: string;
    partnerId: string;
  }): Promise<{ LATENCY_MS: number; WITHIN_BUDGET: boolean }> {
    const notifyAnchor = await this.resolveNotifyAnchor(input.postId);
    const latency = notifyAnchor ? notifyToUiLatencyMs(notifyAnchor) : 0;
    const within = isWithinBudget(latency, NOTIFY_TO_UI_LATENCY_BUDGET_MS);

    this.logger.log(
      formatDualPostingMetricCapturedLog({
        kind: 'NOTIFY_TO_UI_LATENCY',
        postId: input.postId,
        valueMs: latency,
        withinBudget: within,
        detail: `PHASE=UI_RECEIVED;PARTNER=${input.partnerId}`,
      }),
    );
    this.logger.log(
      formatLatencyThresholdValidatedLog({
        kind: 'NOTIFY_TO_UI_LATENCY',
        postId: input.postId,
        valueMs: latency,
        budgetMs: NOTIFY_TO_UI_LATENCY_BUDGET_MS,
      }),
    );

    return { LATENCY_MS: Number(latency.toFixed(2)), WITHIN_BUDGET: within };
  }

  private async resolveNotifyAnchor(postId: string): Promise<Date | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ created_at: Date; contribution_metadata: unknown }>
    >(Prisma.sql`
      SELECT created_at, contribution_metadata
      FROM public.posts
      WHERE id = ${postId}::uuid
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;

    const meta = row.contribution_metadata as { notifiedAt?: string } | null;
    if (meta?.notifiedAt) {
      const parsed = new Date(meta.notifiedAt);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    return row.created_at ?? null;
  }

  private captureAssetThresholdMetric(input: {
    postId: string | null;
    kind: string;
    widthPx?: number | null;
    heightPx?: number | null;
    sizeBytes?: number | null;
  }): void {
    if (
      input.widthPx == null &&
      input.heightPx == null &&
      input.sizeBytes == null
    ) {
      return;
    }

    const result = evaluateAssetOptimization({
      kind: input.kind,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      sizeBytes: input.sizeBytes,
    });

    this.logger.log(
      formatDualPostingMetricCapturedLog({
        kind: 'ASSET_THRESHOLD',
        postId: input.postId,
        withinBudget: result.withinThreshold,
        detail: result.withinThreshold
          ? `KIND=${result.kind};OK`
          : `KIND=${result.kind};FAIL`,
      }),
    );

    if (!result.withinThreshold) {
      this.logger.error(
        formatAssetThresholdFailLog({
          postId: input.postId,
          failures: result.failures,
        }),
      );
    }
  }

  private async captureCdnServeMetric(input: {
    postId: string | null;
    cdnUrl: string;
  }): Promise<void> {
    const samples: number[] = [];
    // Single live probe + synthetic padding for P95 window when cold.
    const probeMs = await this.probeCdnServeMs(input.cdnUrl);
    if (probeMs != null) {
      samples.push(probeMs);
      this.dualPostingHealth.recordCdnServeSample(probeMs);
    }

    const p95 = computeP95(
      samples.length > 0
        ? samples
        : [this.dualPostingHealth.getCdnP95Ms()].filter((n) => n > 0),
    );
    const within = p95 === 0 || isWithinBudget(p95, CDN_SERVE_P95_BUDGET_MS);

    this.logger.log(
      formatDualPostingMetricCapturedLog({
        kind: 'CDN_SERVE',
        postId: input.postId,
        valueMs: probeMs ?? undefined,
        p95Ms: p95,
        withinBudget: within,
        detail: probeMs == null ? 'PROBE_SKIPPED' : 'PROBE_OK',
      }),
    );
    this.logger.log(
      formatLatencyThresholdValidatedLog({
        kind: 'CDN_SERVE',
        postId: input.postId,
        valueMs: p95,
        budgetMs: CDN_SERVE_P95_BUDGET_MS,
      }),
    );

    if (!within) {
      this.logger.error(
        formatCdnServeFailLog({ postId: input.postId, p95Ms: p95 }),
      );
    }
  }

  private async probeCdnServeMs(cdnUrl: string): Promise<number | null> {
    const url = (cdnUrl ?? '').trim();
    if (!url.startsWith('http')) return null;

    const started = nowMs();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1_500);
      try {
        await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      return elapsedMs(started);
    } catch {
      // Fall back to GET range when HEAD is blocked.
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1_500);
        try {
          await fetch(url, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        return elapsedMs(started);
      } catch {
        return null;
      }
    }
  }

  private async insertPost(input: {
    vendorId: string;
    caption: string;
    postType: string;
    contentType: DualContentType;
    metadata: DualContributionMetadata;
    mediaUrl: string | null;
    cdnMediaUrl: string | null;
    mediaCompressed: boolean;
  }): Promise<string> {
    const author = input.metadata.parties.find((p) => p.role === 'AUTHOR')!;
    const partner = input.metadata.parties.find((p) => p.role === 'PARTNER');
    const mediaType =
      input.contentType === 'VIDEO'
        ? 'video'
        : input.contentType === 'PHOTO'
          ? 'image'
          : 'image';

    const partnershipIdSql = input.metadata.partnershipConnectionId
      ? Prisma.sql`${input.metadata.partnershipConnectionId}::uuid`
      : Prisma.sql`NULL`;
    const partnerIdSql = partner?.contributorId
      ? Prisma.sql`${partner.contributorId}::uuid`
      : Prisma.sql`NULL`;
    const partnerTypeSql = partner?.contributorType
      ? Prisma.sql`${partner.contributorType}::public.post_contributor_type`
      : Prisma.sql`NULL`;
    const mediaUrlSql = input.mediaUrl
      ? Prisma.sql`${input.mediaUrl}`
      : Prisma.sql`NULL`;
    const cdnUrlSql = input.cdnMediaUrl
      ? Prisma.sql`${input.cdnMediaUrl}`
      : Prisma.sql`NULL`;

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.posts (
        vendor_id,
        post_type,
        caption,
        content,
        media_url,
        media_type,
        contributor_id,
        contributor_type,
        content_type,
        posting_mode,
        partnership_connection_id,
        partner_contributor_id,
        partner_contributor_type,
        co_approval_status,
        cdn_media_url,
        media_compressed,
        contribution_metadata,
        publish_at
      ) VALUES (
        ${input.vendorId}::uuid,
        ${input.postType},
        ${input.caption},
        ${input.caption},
        ${mediaUrlSql},
        ${mediaType},
        ${author.contributorId}::uuid,
        ${author.contributorType}::public.post_contributor_type,
        ${input.contentType}::public.post_content_type,
        ${input.metadata.postingMode}::public.post_posting_mode,
        ${partnershipIdSql},
        ${partnerIdSql},
        ${partnerTypeSql},
        ${input.metadata.coApprovalStatus}::public.post_co_approval_status,
        ${cdnUrlSql},
        ${input.mediaCompressed},
        ${JSON.stringify(input.metadata)}::jsonb,
        NOW()
      )
      RETURNING id
    `);

    return rows[0].id;
  }

  private async insertContributionRow(input: {
    postId: string;
    contributorId: string;
    contributorType: ContributorType;
    contentType: DualContentType;
    body: string | null;
    mediaUrl: string | null;
    cdnMediaUrl: string | null;
    mediaCompressed: boolean;
    action: string;
    metadata: DualContributionMetadata;
  }): Promise<void> {
    const bodySql = input.body ? Prisma.sql`${input.body}` : Prisma.sql`NULL`;
    const mediaUrlSql = input.mediaUrl
      ? Prisma.sql`${input.mediaUrl}`
      : Prisma.sql`NULL`;
    const cdnUrlSql = input.cdnMediaUrl
      ? Prisma.sql`${input.cdnMediaUrl}`
      : Prisma.sql`NULL`;

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.post_contributions (
        post_id,
        contributor_id,
        contributor_type,
        content_type,
        body,
        media_url,
        cdn_media_url,
        media_compressed,
        action,
        metadata
      ) VALUES (
        ${input.postId}::uuid,
        ${input.contributorId}::uuid,
        ${input.contributorType}::public.post_contributor_type,
        ${input.contentType}::public.post_content_type,
        ${bodySql},
        ${mediaUrlSql},
        ${cdnUrlSql},
        ${input.mediaCompressed},
        ${input.action},
        ${JSON.stringify(input.metadata)}::jsonb
      )
    `);
  }
}
