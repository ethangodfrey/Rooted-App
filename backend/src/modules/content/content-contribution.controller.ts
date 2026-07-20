import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ContentContributionService } from './content-contribution.service';
import { ContentDualPostingHealthService } from './content-dual-posting-health.service';
import type { ContributorType, PostingMode } from './content-contribution.util';

type CreateBody = {
  caption: string;
  postingMode?: PostingMode;
  contentKind?: 'text' | 'image' | 'video' | 'photo';
  mediaUrl?: string | null;
  partnerId?: string | null;
  partnerType?: ContributorType | null;
  partnershipConnectionId?: string | null;
  authorType?: ContributorType;
  postType?: string;
  mediaWidthPx?: number | null;
  mediaHeightPx?: number | null;
  mediaSizeBytes?: number | null;
};

type PartnerActionBody = {
  postId: string;
  action: 'CO_APPROVE' | 'APPEND' | 'REJECT';
  body?: string | null;
  mediaUrl?: string | null;
  contentKind?: 'text' | 'image' | 'video' | 'photo';
  partnerType?: ContributorType;
  mediaWidthPx?: number | null;
  mediaHeightPx?: number | null;
  mediaSizeBytes?: number | null;
};

type PartnerUiReceivedBody = {
  postIds: string[];
};

@Controller('api/content/contributions')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ContentContributionController {
  private readonly logger = new Logger(ContentContributionController.name);

  constructor(
    private readonly contributions: ContentContributionService,
    private readonly health: ContentDualPostingHealthService,
  ) {}

  @Post()
  @Roles('vendor', 'farmer', 'admin')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBody,
  ) {
    if (!user.vendorId) {
      throw new BadRequestException('VENDOR_REQUIRED');
    }

    const caption = (body.caption ?? '').trim();
    if (!caption) {
      throw new BadRequestException('CAPTION_REQUIRED');
    }

    const postingMode: PostingMode =
      body.postingMode === 'PARTNERSHIP' ? 'PARTNERSHIP' : 'SELF';

    if (postingMode === 'PARTNERSHIP') {
      if (!body.partnerId || !body.partnerType) {
        throw new BadRequestException('PARTNERSHIP_REQUIRES_PARTNER');
      }
    }

    const result = await this.contributions.createContribution({
      vendorId: user.vendorId,
      authorId: user.id,
      authorType: body.authorType ?? 'VENDOR',
      postingMode,
      contentKind: body.contentKind ?? 'text',
      caption,
      mediaUrl: body.mediaUrl,
      partnerId: body.partnerId,
      partnerType: body.partnerType,
      partnershipConnectionId: body.partnershipConnectionId,
      postType: body.postType,
      mediaWidthPx: body.mediaWidthPx,
      mediaHeightPx: body.mediaHeightPx,
      mediaSizeBytes: body.mediaSizeBytes,
    });

    this.logger.log(
      `DUAL_POSTING_INTERFACE_INITIALIZED ACTION=CREATE POST=${result.POST_ID} MODE=${postingMode}`,
    );

    return {
      STATUS: 'CONTENT_CONTRIBUTION_SYNCED',
      ...result,
    };
  }

  @Post('partner-action')
  @Roles('vendor', 'farmer', 'admin')
  async partnerAction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PartnerActionBody,
  ) {
    if (!body.postId || !body.action) {
      throw new BadRequestException('PARTNER_ACTION_REQUIRED');
    }

    const partnerId = user.id;
    const result = await this.contributions.coApproveOrAppend({
      postId: body.postId,
      partnerId,
      partnerType: body.partnerType ?? 'VENDOR',
      action: body.action,
      body: body.body,
      mediaUrl: body.mediaUrl,
      contentKind: body.contentKind,
      mediaWidthPx: body.mediaWidthPx,
      mediaHeightPx: body.mediaHeightPx,
      mediaSizeBytes: body.mediaSizeBytes,
    });

    return {
      ...result,
      CO_APPROVAL: result.STATUS,
      STATUS: 'CONTENT_CONTRIBUTION_SYNCED',
    };
  }

  @Post('partner-ui-received')
  @Roles('vendor', 'farmer', 'admin')
  async partnerUiReceived(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PartnerUiReceivedBody,
  ) {
    const postIds = Array.isArray(body.postIds)
      ? body.postIds.filter((id) => typeof id === 'string' && id.trim())
      : [];
    if (postIds.length === 0) {
      throw new BadRequestException('POST_IDS_REQUIRED');
    }

    const samples = [];
    for (const postId of postIds.slice(0, 20)) {
      samples.push(
        await this.contributions.recordPartnerUiReceived({
          postId,
          partnerId: user.id,
        }),
      );
    }

    return {
      STATUS: 'DUAL_POSTING_METRIC_CAPTURED',
      SAMPLES: samples,
    };
  }

  @Post('health/sync')
  @Roles('admin')
  async syncHealth() {
    const result = await this.health.validateSyncHealth();
    return {
      ...result,
      HEALTH_STATUS: result.STATUS,
      STATUS: 'LATENCY_THRESHOLD_VALIDATED',
    };
  }
}
