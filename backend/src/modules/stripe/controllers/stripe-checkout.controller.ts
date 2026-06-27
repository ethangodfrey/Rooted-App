import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { CreateCheckoutSessionDto } from '../dto/create-checkout-session.dto';
import { StripeService } from '../stripe.service';

@Controller('stripe/checkout')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('shopper')
export class StripeCheckoutController {
  constructor(private readonly stripe: StripeService) {}

  /** Create a Stripe Checkout Session for an order the customer owns. */
  @Post('session')
  async createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.stripe.createOrderCheckoutSession({
      orderId: dto.orderId,
      customerUserId: user.id,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }
}
