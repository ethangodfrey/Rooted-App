import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('checkout')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('shopper')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  createCheckout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCheckoutDto) {
    return this.checkout.createCheckout(user, dto);
  }

  @Get('transactions/:id')
  getCheckout(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.checkout.getCheckout(user, id);
  }
}
