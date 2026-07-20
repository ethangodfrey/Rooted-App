import { Module } from '@nestjs/common';

import { FinancialModule } from '../financial/financial.module';
import { InventoryLedgerModule } from '../inventory/inventory-ledger.module';
import { ApiPaymentsController } from './controllers/api-payments.controller';
import { ApiStripeWebhooksController } from './controllers/api-stripe-webhooks.controller';
import { WebhooksStripeController } from './controllers/webhooks-stripe.controller';
import { StripeCheckoutController } from './controllers/stripe-checkout.controller';
import { StripeConnectController } from './controllers/stripe-connect.controller';
import { StripeWebhooksController } from './controllers/stripe-webhooks.controller';
import { PaymentsGatewayService } from './payments-gateway.service';
import { StripeOnboardingService } from './stripe-onboarding.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [InventoryLedgerModule, FinancialModule],
  controllers: [
    ApiPaymentsController,
    ApiStripeWebhooksController,
    WebhooksStripeController,
    StripeConnectController,
    StripeCheckoutController,
    StripeWebhooksController,
  ],
  providers: [StripeService, PaymentsGatewayService, StripeOnboardingService],
  exports: [StripeService, PaymentsGatewayService, StripeOnboardingService],
})
export class StripeModule {}
