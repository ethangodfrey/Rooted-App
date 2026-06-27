import { Module } from '@nestjs/common';

import { StripeCheckoutController } from './controllers/stripe-checkout.controller';
import { StripeConnectController } from './controllers/stripe-connect.controller';
import { StripeWebhooksController } from './controllers/stripe-webhooks.controller';
import { StripeService } from './stripe.service';

@Module({
  controllers: [
    StripeConnectController,
    StripeCheckoutController,
    StripeWebhooksController,
  ],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
