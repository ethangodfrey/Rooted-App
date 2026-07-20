import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Patch,
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
  formatProcurementDashboardInitializedLog,
  formatWholesaleDirectoryActiveLog,
  formatWholesaleUiActiveLog,
} from './b2b-marketplace.util';

@Controller('api/b2b')
export class B2bMarketplaceController implements OnModuleInit {
  private readonly logger = new Logger(B2bMarketplaceController.name);

  constructor(private readonly marketplace: B2bMarketplaceService) {}

  onModuleInit(): void {
    this.logger.log(formatB2bMarketplaceInitializedLog());
    this.logger.log(formatWholesaleDirectoryActiveLog());
    this.logger.log(formatProcurementDashboardInitializedLog());
    this.logger.log(formatWholesaleUiActiveLog());
  }

  /**
   * GET /api/b2b/directory
   * Active wholesale listings — optional q, location, category filters.
   */
  @Get('directory')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async directory(
    @Query('limit') limitRaw?: string,
    @Query('q') q?: string,
    @Query('location') location?: string,
    @Query('category') category?: string,
  ) {
    const limit =
      limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;
    return this.marketplace.listDirectory({
      limit: limit != null && Number.isFinite(limit) ? limit : 40,
      q: q ?? null,
      location: location ?? null,
      category: category ?? null,
    });
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
  @Roles('vendor', 'farmer', 'admin')
  async listProcurement(@CurrentUser() user: AuthenticatedUser) {
    if (user.role === 'farmer') {
      const farmerId = await this.marketplace.resolveFarmerIdForUser(user.id);
      return this.marketplace.listProcurementForFarmer(farmerId);
    }
    const vendorId = user.vendorId;
    if (!vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.marketplace.listProcurementForVendor(vendorId);
  }

  /**
   * PATCH /api/b2b/procurement/:id
   * Farmer accepts/declines; vendor may cancel pending.
   * Farmer status updates notify the vendor.
   */
  @Patch('procurement/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async updateProcurement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    if (!id?.trim()) throw new BadRequestException('REQUEST_ID_REQUIRED');
    if (!body.status?.trim()) throw new BadRequestException('STATUS_REQUIRED');

    let farmerId: string | null = null;
    if (user.role === 'farmer' || user.role === 'admin') {
      try {
        farmerId = await this.marketplace.resolveFarmerIdForUser(user.id);
      } catch {
        farmerId = null;
      }
    }

    return this.marketplace.updateProcurementStatus({
      requestId: id.trim(),
      statusRaw: body.status,
      actor: {
        role: user.role,
        vendorId: user.vendorId ?? null,
        farmerId,
      },
    });
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
