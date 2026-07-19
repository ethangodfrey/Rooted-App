import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { parseWholesaleProductCreate } from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { WholesaleProductsService } from './wholesale-products.service';

@Controller('api/vendors/wholesale-products')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class WholesaleProductsController {
  constructor(private readonly wholesale: WholesaleProductsService) {}

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const vendorId = this.requireVendor(user);
    const parsed = parseWholesaleProductCreate(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const product = await this.wholesale.create(vendorId, parsed.DATA);

    return {
      STATUS: 'WHOLESALE_SKU_INDEXED',
      PRODUCT: {
        ID: product.id,
        VENDOR_ID: product.vendorId,
        NAME: product.name,
        PACKAGING_UNIT: product.packagingUnit,
        WEIGHT_LBS: Number(product.weightLbs),
        MOQ: product.moq,
        UNIT_PRICE_CENTS: product.unitPriceCents,
        PRICING_TIERS: product.pricingTiers,
        FREIGHT_NOTES: product.freightNotes,
        PICKUP_NOTES: product.pickupNotes,
        STATUS: product.status,
      },
    };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = this.requireVendor(user);
    const rows = await this.wholesale.listForVendor(vendorId);
    return {
      STATUS: 'WHOLESALE_CATALOG',
      COUNT: rows.length,
      PRODUCTS: rows.map((product) => ({
        ID: product.id,
        NAME: product.name,
        PACKAGING_UNIT: product.packagingUnit,
        WEIGHT_LBS: Number(product.weightLbs),
        MOQ: product.moq,
        UNIT_PRICE_CENTS: product.unitPriceCents,
        PRICING_TIERS: product.pricingTiers,
        FREIGHT_NOTES: product.freightNotes,
        PICKUP_NOTES: product.pickupNotes,
        STATUS: product.status,
      })),
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
