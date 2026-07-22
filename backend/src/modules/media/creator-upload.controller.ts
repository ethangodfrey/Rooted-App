import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatorUploadService } from './creator-upload.service';
import { CreatorUploadDto } from './dto/creator-upload.dto';

@Controller('api/creator')
export class CreatorUploadController {
  constructor(
    private readonly uploads: CreatorUploadService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/creator/upload
   * Validates mobile-feed media, creates streaming session, persists post asset URL.
   */
  @Post('upload')
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor')
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatorUploadDto,
  ) {
    const vendorId = await this.resolveVendorId(user);
    return this.uploads.ingest(vendorId, dto);
  }

  /**
   * GET /api/creator/feed
   * Streaming-ready assets for VerticalVideoFeed.
   */
  @Get('feed')
  async feed(@Query('limit') limitRaw?: string) {
    const limit = Number.parseInt(limitRaw ?? '24', 10);
    return this.uploads.listFeed(Number.isFinite(limit) ? limit : 24);
  }

  private async resolveVendorId(user: AuthenticatedUser): Promise<string> {
    if (user.vendorId) return user.vendorId;
    const vendor = await this.prisma.vendor.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!vendor) {
      throw new UnauthorizedException('CREATOR_UPLOAD_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return vendor.id;
  }
}
