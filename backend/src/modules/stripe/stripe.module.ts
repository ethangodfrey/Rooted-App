import { Module } from '@nestjs/common';

import { ApiPaymentsController } from './controllers/api-payments.controller';
import { ApiStripeWebhooksController } from './controllers/api-stripe-webhooks.controller';
import { StripeCheckoutController } from './controllers/stripe-checkout.controller';
import { StripeConnectController } from './controllers/stripe-connect.controller';
import { StripeWebhooksController } from './controllers/stripe-webhooks.controller';
import { StripeService } from './stripe.service';

@Module({
  controllers: [
    ApiPaymentsController,
    ApiStripeWebhooksController,
    StripeConnectController,
    StripeCheckoutController,
    StripeWebhooksController,
  ],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
