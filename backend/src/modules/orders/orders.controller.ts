import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyHandoffDto } from './dto/verify-handoff.dto';
import {
  OrdersCreateService,
  type CreateOrderResponse,
} from './orders-create.service';
import {
  OrdersHandoffService,
  type VerifyHandoffResponse,
} from './orders-handoff.service';

/**
 * Core order lifecycle HTTP surface.
 * - POST /orders — pre-order reservation (shopper)
 * - POST /orders/verify-handoff — pickup token redemption (vendor)
 */
@Controller('orders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly createOrders: OrdersCreateService,
    private readonly handoffs: OrdersHandoffService,
  ) {}

  @Post()
  @Roles('shopper')
  @HttpCode(201)
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<CreateOrderResponse> {
    return this.createOrders.createOrder(user, dto);
  }

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
