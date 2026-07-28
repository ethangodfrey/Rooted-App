import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { ChefProcurementService } from './chef-procurement.service';

@Controller('api/b2b/chef-procurement')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('chef', 'vendor', 'admin')
export class ChefProcurementController {
  constructor(private readonly procurement: ChefProcurementService) {}

  /**
   * GET /api/b2b/chef-procurement/catalog
   * Wholesale-eligible products for Private Chefs and verified vendors.
   */
  @Get('catalog')
  async catalog(@Query('q') q?: string, @Query('limit') limitRaw?: string) {
    const limit =
      limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;
    return this.procurement.listCatalog({
      q: q ?? null,
      limit: limit != null && Number.isFinite(limit) ? limit : 40,
    });
  }

  @Get('orders')
  async myOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.procurement.listMyOrders(user.id);
  }

  /**
   * POST /api/b2b/chef-procurement/checkout
   * Multi-line MOQ cart → Stripe Connect escrow checkout.
   */
  @Post('checkout')
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      lines?: Array<{ productId?: string; quantity?: number }>;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    if (user.role !== 'chef' && user.role !== 'vendor' && user.role !== 'admin') {
      throw new BadRequestException('BUYER_ROLE_REQUIRED');
    }
    if (user.role === 'vendor' && !user.vendorId) {
      throw new BadRequestException('VENDOR_REQUIRED');
    }

    const lines = (body.lines ?? [])
      .map((line) => ({
        productId: String(line.productId ?? '').trim(),
        quantity: Number(line.quantity),
      }))
      .filter((line) => line.productId);

    return this.procurement.checkout({
      buyerUserId: user.id,
      buyerRole: user.role === 'vendor' ? 'vendor' : 'chef',
      buyerVendorId: user.vendorId ?? null,
      lines,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  /**
   * POST /api/b2b/chef-procurement/:orderId/confirm-pickup
   * Verify digital hand-off / pickup code → release HELD_IN_ESCROW funds.
   */
  @Post(':orderId/confirm-pickup')
  async confirmPickup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() body: { pickupCode?: string },
  ) {
    const pickupCode = String(body.pickupCode ?? '').trim();
    if (!pickupCode) throw new BadRequestException('PICKUP_CODE_REQUIRED');

    return this.procurement.confirmPickup({
      orderId,
      pickupCode,
      actorUserId: user.id,
      actorRole: user.role,
      actorVendorId: user.vendorId ?? null,
    });
  }
}
