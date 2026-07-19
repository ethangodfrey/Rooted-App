import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { CreateConnectLinkDto } from '../dto/create-connect-link.dto';
import { StripeService } from '../stripe.service';

@Controller('stripe/connect')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class StripeConnectController {
  constructor(
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  /** Start or resume Stripe Connect Express onboarding for the authenticated vendor. */
  @Post('onboard')
  async onboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConnectLinkDto,
  ) {
    const vendorId = this.requireVendor(user);
    const webBase = this.config
      .get<string>('WEB_APP_URL', 'http://localhost:5173')
      .replace(/\/$/, '');

    const returnUrl = dto.returnUrl ?? `${webBase}/vendor/settings/payments?stripe=return`;
    const refreshUrl = dto.refreshUrl ?? `${webBase}/vendor/settings/payments?stripe=refresh`;

    const result = await this.stripe.createVendorConnectLink(
      vendorId,
      returnUrl,
      refreshUrl,
    );
    return {
      ...result,
      STATUS: 'STRIPE_ACCOUNT_LINKED',
      VENDOR_ID: vendorId,
    };
  }

  /** Poll Connect readiness after onboarding redirect. */
  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const vendorId = this.requireVendor(user);
    const result = await this.stripe.getVendorConnectStatus(vendorId);
    return {
      ...result,
      STATUS: result.connected
        ? 'STRIPE_ACCOUNT_LINKED'
        : 'STRIPE_ACCOUNT_PENDING',
      VENDOR_ID: vendorId,
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new BadRequestException('Vendor profile required.');
    }
    return user.vendorId;
  }
}
