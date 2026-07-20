import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  B2bMarketplaceService,
  type CreateListingBody,
  type CreateProcurementBody,
} from './b2b-marketplace.service';
import {
  formatB2bMarketplaceInitializedLog,
  formatWholesaleDirectoryActiveLog,
} from './b2b-marketplace.util';

@Controller('api/b2b')
export class B2bMarketplaceController implements OnModuleInit {
  private readonly logger = new Logger(B2bMarketplaceController.name);

  constructor(private readonly marketplace: B2bMarketplaceService) {}

  onModuleInit(): void {
    this.logger.log(formatB2bMarketplaceInitializedLog());
    this.logger.log(formatWholesaleDirectoryActiveLog());
  }

  /**
   * GET /api/b2b/directory
   * Active wholesale listings from flagged farmers/vendors.
   */
  @Get('directory')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async directory(@Query('limit') limitRaw?: string) {
    const limit =
      limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;
    return this.marketplace.listDirectory(
      limit != null && Number.isFinite(limit) ? limit : 40,
    );
  }

  /**
   * POST /api/b2b/procurement
   * Vendor requests a bulk connection / procurement with a farmer.
   */
  @Post('procurement')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
  async procurement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateProcurementBody,
  ) {
    const vendorId = user.vendorId;
    if (!vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.marketplace.createProcurement(vendorId, body);
  }

  @Get('procurement')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
  async listProcurement(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = user.vendorId;
    if (!vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.marketplace.listProcurementForVendor(vendorId);
  }

  @Post('listings')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async createListing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateListingBody,
  ) {
    if (user.role === 'farmer') {
      const farmerId = await this.marketplace.resolveFarmerIdForUser(user.id);
      return this.marketplace.createListing(farmerId, 'FARMER', body);
    }
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.marketplace.createListing(user.vendorId, 'VENDOR', body);
  }

  @Put('flags')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async setFlags(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { enabled?: boolean },
  ) {
    const enabled = Boolean(body.enabled);
    if (user.role === 'farmer') {
      const farmerId = await this.marketplace.resolveFarmerIdForUser(user.id);
      return this.marketplace.setWholesaleFlags({ farmerId, enabled });
    }
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.marketplace.setWholesaleFlags({
      vendorId: user.vendorId,
      enabled,
    });
  }
}
