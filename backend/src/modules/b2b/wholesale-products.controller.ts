import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { parseWholesaleProductCreate } from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { WholesaleProductsService } from './wholesale-products.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      INDEX: 'ELASTICSEARCH_SYNC_COMPLETED',
      PRODUCT: this.serialize(product),
    };
  }

  /**
   * PATCH /api/vendors/wholesale-products/:productId
   * Ownership-gated catalog update — re-indexes to Elasticsearch.
   */
  @Patch(':productId')
  @HttpCode(200)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ) {
    const vendorId = this.requireVendor(user);
    if (!UUID_RE.test(productId.trim())) {
      throw new BadRequestException(
        'WHOLESALE_VALIDATION_ERROR: PRODUCT_ID INVALID',
      );
    }
    const patch = (body && typeof body === 'object' ? body : {}) as {
      name?: string;
      moq?: number;
      unitPriceCents?: number;
    };
    const product = await this.wholesale.updateForVendor(
      vendorId,
      productId.trim(),
      {
        ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
        ...(typeof patch.moq === 'number' ? { moq: patch.moq } : {}),
        ...(typeof patch.unitPriceCents === 'number'
          ? { unitPriceCents: patch.unitPriceCents }
          : {}),
      },
    );
    return {
      STATUS: 'WHOLESALE_SKU_UPDATED',
      INDEX: 'ELASTICSEARCH_SYNC_COMPLETED',
      PRODUCT: this.serialize(product),
    };
  }

  /**
   * GET /api/vendors/wholesale-products
   * Own catalog by default; peer discovery via ?vendorId=
   */
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('vendorId') peerVendorId?: string,
  ) {
    const sessionVendorId = this.requireVendor(user);

    if (peerVendorId?.trim()) {
      if (!UUID_RE.test(peerVendorId.trim())) {
        throw new BadRequestException('WHOLESALE_VALIDATION_ERROR: VENDOR_ID INVALID');
      }
      const catalog = await this.wholesale.listCatalogForVendor(peerVendorId.trim());
      if (!catalog) {
        throw new NotFoundException('WHOLESALE_ERROR: VENDOR_NOT_FOUND');
      }
      return {
        STATUS: 'WHOLESALE_CATALOG',
        VIEW: 'PEER',
        SESSION_VENDOR_ID: sessionVendorId,
        VENDOR_ID: catalog.vendor.id,
        VENDOR_NAME: catalog.vendor.businessName,
        COUNT: catalog.products.length,
        PRODUCTS: catalog.products.map((product) => this.serialize(product)),
      };
    }

    const rows = await this.wholesale.listForVendor(sessionVendorId);
    return {
      STATUS: 'WHOLESALE_CATALOG',
      VIEW: 'OWN',
      SESSION_VENDOR_ID: sessionVendorId,
      VENDOR_ID: sessionVendorId,
      COUNT: rows.length,
      PRODUCTS: rows.map((product) => this.serialize(product)),
    };
  }

  private serialize(product: {
    id: string;
    vendorId: string;
    name: string;
    packagingUnit: string;
    weightLbs: { toString(): string } | number;
    moq: number;
    unitPriceCents: number;
    pricingTiers: unknown;
    freightNotes: string | null;
    pickupNotes: string | null;
    availableQuantity: number;
    status: string;
  }) {
    return {
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
      AVAILABLE_QUANTITY: product.availableQuantity,
      STATUS: product.status,
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
