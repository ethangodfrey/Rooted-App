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
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { parseWholesaleProductCreate } from '@vendorly/env-config';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { WholesaleDiscoverySearchService } from '../search/wholesale-discovery-search.service';
import type { WholesaleUsGeoContext } from '../search/us-wholesale-proximity.middleware';
import { VendorConnectionsService } from './vendor-connections.service';
import { WholesaleProductsService } from './wholesale-products.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('api/vendors/wholesale-products')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class WholesaleProductsController {
  constructor(
    private readonly wholesale: WholesaleProductsService,
    private readonly discovery: WholesaleDiscoverySearchService,
    private readonly connections: VendorConnectionsService,
  ) {}

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
      isRetailEnabled?: boolean;
      retailPrice?: number | null;
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
        ...(typeof patch.isRetailEnabled === 'boolean'
          ? { isRetailEnabled: patch.isRetailEnabled }
          : {}),
        ...(patch.retailPrice === null || typeof patch.retailPrice === 'number'
          ? { retailPrice: patch.retailPrice }
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
   * GET /api/vendors/wholesale-products/search?q=&latitude=&longitude=&radiusMiles=
   * Hybrid ranking: baseRelevance * connectedBoost * proximityBoost (US-only radius).
   */
  @Get('search')
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { wholesaleUsGeo?: WholesaleUsGeoContext },
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const sessionVendorId = this.requireVendor(user);
    const geo = req.wholesaleUsGeo;
    const query =
      geo?.q ?? (typeof q === 'string' ? q : '');
    const limit = geo?.limit ?? Number.parseInt(limitRaw ?? '40', 10);
    const proximity =
      geo?.proximityEnabled &&
      geo.latitude != null &&
      geo.longitude != null &&
      geo.radiusMiles != null
        ? {
            latitude: geo.latitude,
            longitude: geo.longitude,
            radiusMiles: geo.radiusMiles,
          }
        : null;

    const connectedVendorIds =
      await this.connections.listAcceptedConnectedVendorIds(sessionVendorId);
    const result = await this.discovery.search({
      sessionVendorId,
      query,
      connectedVendorIds,
      limit: Number.isFinite(limit) ? limit : 40,
      proximity,
    });

    return {
      STATUS: proximity
        ? 'RADIUS_SEARCH_OPTIMIZED'
        : 'RANKING_ALGORITHM_REFINED',
      SESSION_VENDOR_ID: sessionVendorId,
      QUERY: query,
      SOURCE: result.SOURCE,
      MULTIPLIER: result.MULTIPLIER,
      PROXIMITY_WEIGHT: result.PROXIMITY_WEIGHT,
      COUNTRY_CODE: result.COUNTRY_CODE,
      RADIUS_MILES: result.RADIUS_MILES,
      CONNECTED_WHOLESALERS: connectedVendorIds,
      BOOSTED_COUNT: result.BOOSTED_COUNT,
      COUNT: result.HITS.length,
      PRODUCTS: result.HITS.map((hit) => ({
        ID: hit.id,
        VENDOR_ID: hit.vendorId,
        NAME: hit.name,
        DESCRIPTION: hit.description,
        PACKAGING_UNIT: hit.packagingUnit,
        MOQ: hit.moq,
        UNIT_PRICE_CENTS: hit.unitPriceCents,
        AVAILABLE_QUANTITY: hit.availableQuantity,
        STATUS: hit.status,
        BASE_SCORE: hit.baseScore,
        BOOST_APPLIED: hit.boostApplied,
        PROXIMITY_BOOST: hit.proximityBoost,
        SCORE: hit.score,
        CONNECTED_WHOLESALER: hit.CONNECTED_WHOLESALER,
        DISTANCE_MILES: hit.distanceMiles,
      })),
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
    isRetailEnabled?: boolean;
    retailPrice?: { toString(): string } | number | null;
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
      IS_RETAIL_ENABLED: product.isRetailEnabled ?? false,
      RETAIL_PRICE:
        product.retailPrice == null ? null : Number(product.retailPrice),
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
