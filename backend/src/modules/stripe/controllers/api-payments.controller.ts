import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { CreateConnectLinkDto } from '../dto/create-connect-link.dto';
import { StripeService } from '../stripe.service';

@Controller('api/payments')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class ApiPaymentsController {
  constructor(
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  @Post('connect-vendor')
  connectVendor(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConnectLinkDto) {
    if (!user.vendorId) throw new BadRequestException('Vendor profile required.');
    const webBase = this.config
      .get<string>('WEB_APP_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    return this.stripe.createVendorConnectLink(
      user.vendorId,
      dto.returnUrl ?? `${webBase}/vendor/settings/payments?stripe=return`,
      dto.refreshUrl ?? `${webBase}/vendor/settings/payments?stripe=refresh`,
    );
  }
}
