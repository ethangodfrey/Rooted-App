import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { parseWholesaleOrderDraftCreate } from '@vendorly/env-config';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { WholesaleOrdersService } from './wholesale-orders.service';

@Controller('api/vendors/orders/drafts')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class WholesaleOrdersController {
  constructor(private readonly orders: WholesaleOrdersService) {}

  /**
   * POST /api/vendors/orders/drafts
   * Initialize a multi-tenant wholesale order draft from validated line items.
   */
  @Post()
  @HttpCode(201)
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const vendorId = this.requireVendor(user);
    const parsed = parseWholesaleOrderDraftCreate(body);
    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const order = await this.orders.createDraft(vendorId, parsed.DATA);

    return {
      STATUS: 'ORDER_DRAFT_INITIALIZED',
      ORDER: {
        ID: order.id,
        BUYER_VENDOR_ID: order.buyerVendorId,
        SELLER_VENDOR_ID: order.sellerVendorId,
        STATUS: order.status,
        CURRENCY: order.currency,
        SUBTOTAL_CENTS: order.subtotalCents,
        ITEMS: order.items.map((item) => ({
          ID: item.id,
          PRODUCT_SKU_ID: item.productSkuId,
          QUANTITY: item.quantity,
          NEGOTIATED_TIER_UNIT_PRICE: item.negotiatedTierUnitPrice,
          LINE_TOTAL_CENTS: item.lineTotalCents,
        })),
        CREATED_AT: order.createdAt.toISOString(),
      },
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
