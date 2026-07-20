import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  OnModuleInit,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { CreateConnectLinkDto } from '../dto/create-connect-link.dto';
import { PaymentsGatewayService } from '../payments-gateway.service';
import {
  formatPaymentWebhooksActiveLog,
  formatStripeGatewayInitializedLog,
} from '../payments-gateway.util';
import { StripeOnboardingService } from '../stripe-onboarding.service';
import {
  formatBankLinkInitializedLog,
  formatStripeOnboardingActiveLog,
} from '../stripe-onboarding.util';
import { StripeService } from '../stripe.service';

@Controller('api/payments')
export class ApiPaymentsController implements OnModuleInit {
  private readonly logger = new Logger(ApiPaymentsController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly payments: PaymentsGatewayService,
    private readonly onboarding: StripeOnboardingService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatStripeGatewayInitializedLog());
    this.logger.log(formatPaymentWebhooksActiveLog());
    this.logger.log(formatStripeOnboardingActiveLog());
    this.logger.log(formatBankLinkInitializedLog());
  }

  @Post('connect-vendor')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor')
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

  /**
   * POST /api/payments/onboard
   * Stripe Connect Account Link for the signed-in vendor or farmer.
   */
  @Post('onboard')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async onboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConnectLinkDto,
  ) {
    return this.onboarding.createOnboardingLink(user, {
      returnUrl: dto.returnUrl,
      refreshUrl: dto.refreshUrl,
      action: 'ONBOARD',
    });
  }

  /**
   * GET /api/payments/onboard/refresh
   * Re-issue an Account Link when the user drops off Stripe hosted onboarding.
   */
  @Get('onboard/refresh')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async onboardRefresh(
    @CurrentUser() user: AuthenticatedUser,
    @Query('returnUrl') returnUrl?: string,
    @Query('refreshUrl') refreshUrl?: string,
  ) {
    return this.onboarding.refreshOnboardingLink(user, {
      returnUrl,
      refreshUrl,
    });
  }

  /**
   * GET /api/payments/onboard/status
   * Whether stripe_account_id is present (Payouts Enabled badge).
   */
  @Get('onboard/status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async onboardStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getOnboardingStatus(user);
  }

  /**
   * POST /api/payments/checkout
   * Create a Stripe Checkout Session for a catering / procurement reference.
   */
  @Post('checkout')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async checkout(
    @Body()
    body: {
      reference_id?: string;
      referenceId?: string;
      amount?: number;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const referenceId = (body.reference_id ?? body.referenceId ?? '').trim();
    if (!referenceId) throw new BadRequestException('REFERENCE_ID_REQUIRED');
    if (body.amount == null) throw new BadRequestException('AMOUNT_REQUIRED');
    return this.payments.createCheckoutSession({
      referenceId,
      amount: Number(body.amount),
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  /**
   * POST /api/payments/webhook
   * Stripe webhook — checkout.session.completed → holdInEscrow(reference_id, amount).
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    if (!this.stripe.isConfigured()) {
      throw new ServiceUnavailableException('webhook_not_configured');
    }
    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body ?? {});
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe-Signature header.');
    }
    return this.payments.handleWebhook(rawBody, signature);
  }
}
