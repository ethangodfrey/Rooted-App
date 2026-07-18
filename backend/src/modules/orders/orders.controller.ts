import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { VerifyHandoffDto } from './dto/verify-handoff.dto';
import {
  OrdersHandoffService,
  type VerifyHandoffResponse,
} from './orders-handoff.service';

/**
 * Secure mobile handoff verification.
 * Maps product path: POST /api/orders/verify-handoff
 */
@Controller('orders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly handoffs: OrdersHandoffService) {}

  @Post('verify-handoff')
  @Roles('vendor', 'admin')
  @HttpCode(200)
  async verifyHandoff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyHandoffDto,
  ): Promise<VerifyHandoffResponse> {
    return this.handoffs.verifyHandoff(user, dto.code);
  }
}
