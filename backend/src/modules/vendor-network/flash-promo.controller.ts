import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { FlashPromoService } from './flash-promo.service';
import type { CreateFlashPromoInput } from './flash-promo.util';

@Controller('api/vendors/flash-promo')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class FlashPromoController {
  constructor(
    private readonly flashPromo: FlashPromoService,
    private readonly prisma: PrismaService,
  ) {}

  /** GET /api/vendors/flash-promo */
  @Get()
  async get(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = await this.resolveVendorId(user);
    return this.flashPromo.getActiveCampaign(vendorId);
  }

  /** POST /api/vendors/flash-promo */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFlashPromoInput,
  ) {
    const vendorId = await this.resolveVendorId(user);
    return this.flashPromo.createCampaign(vendorId, body);
  }

  /** DELETE /api/vendors/flash-promo */
  @Delete()
  @HttpCode(204)
  async clear(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = await this.resolveVendorId(user);
    await this.flashPromo.clearCampaign(vendorId);
  }

  private async resolveVendorId(user: AuthenticatedUser): Promise<string> {
    const vendor = await this.prisma.vendor.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!vendor) {
      throw new UnauthorizedException('FLASH_PROMO_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return vendor.id;
  }
}
