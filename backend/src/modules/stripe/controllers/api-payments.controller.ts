import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Logger,
  OnModuleInit,
  Post,
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
import { StripeService } from '../stripe.service';

@Controller('api/payments')
export class ApiPaymentsController implements OnModuleInit {
  private readonly logger = new Logger(ApiPaymentsController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly payments: PaymentsGatewayService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatStripeGatewayInitializedLog());
    this.logger.log(formatPaymentWebhooksActiveLog());
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
