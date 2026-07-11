import { Module } from '@nestjs/common';

import { InventoryLedgerModule } from '../inventory/inventory-ledger.module';
import { ApiPaymentsController } from './controllers/api-payments.controller';
import { ApiStripeWebhooksController } from './controllers/api-stripe-webhooks.controller';
import { WebhooksStripeController } from './controllers/webhooks-stripe.controller';
import { StripeCheckoutController } from './controllers/stripe-checkout.controller';
import { StripeConnectController } from './controllers/stripe-connect.controller';
import { StripeWebhooksController } from './controllers/stripe-webhooks.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [InventoryLedgerModule],
  controllers: [
    ApiPaymentsController,
    ApiStripeWebhooksController,
    WebhooksStripeController,
    StripeConnectController,
    StripeCheckoutController,
    StripeWebhooksController,
  ],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
