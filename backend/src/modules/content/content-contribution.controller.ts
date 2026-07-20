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
};

type PartnerActionBody = {
  postId: string;
  action: 'CO_APPROVE' | 'APPEND' | 'REJECT';
  body?: string | null;
  mediaUrl?: string | null;
  contentKind?: 'text' | 'image' | 'video' | 'photo';
  partnerType?: ContributorType;
};

@Controller('api/content/contributions')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ContentContributionController {
  private readonly logger = new Logger(ContentContributionController.name);

  constructor(private readonly contributions: ContentContributionService) {}

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
    });

    return {
      ...result,
      CO_APPROVAL: result.STATUS,
      STATUS: 'CONTENT_CONTRIBUTION_SYNCED',
    };
  }
}
