import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { buildCompressedMediaResult } from './content-media-cdn.util';
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

  constructor(private readonly prisma: PrismaService) {}

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

    const postId = await this.insertPost({
      vendorId: input.vendorId,
      caption: input.caption,
      postType: input.postType ?? 'announcement',
      contentType,
      metadata,
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
      metadata,
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
      METADATA: metadata,
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
  }): Promise<{ STATUS: string; METADATA: DualContributionMetadata }> {
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

    const status =
      input.action === 'CO_APPROVE'
        ? 'APPROVED'
        : input.action === 'APPEND'
          ? 'APPENDED'
          : 'REJECTED';

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
