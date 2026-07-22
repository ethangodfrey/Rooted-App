import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { nestConfigValidate } from '@vendorly/env-config';

import { CryptoModule } from './common/crypto/crypto.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { isPosQueuesEnabledFromEnv } from './common/redis/pos-queues-enabled';
import { resolveRedisConnection } from './common/redis/redis-connection';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AdminAgentModule } from './modules/admin-agent/admin-agent.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { MarketsModule } from './modules/markets/markets.module';
import { MediaModule } from './modules/media/media.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PosModule } from './modules/pos/pos.module';

import { StripeModule } from './modules/stripe/stripe.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { B2bModule } from './modules/b2b/b2b.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { ContentModule } from './modules/content/content.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { CateringModule } from './modules/catering/catering.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { FinancialModule } from './modules/financial/financial.module';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SupplierAnalyticsModule } from './modules/supplier-analytics/supplier-analytics.module';
import { VendorNetworkModule } from './modules/vendor-network/vendor-network.module';

const posQueuesEnabled = isPosQueuesEnabledFromEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: nestConfigValidate,
    }),
    ScheduleModule.forRoot(),
    ...(posQueuesEnabled
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: resolveRedisConnection(config),
              defaultJobOptions: {
                attempts: 5,
                backoff: { type: 'exponential', delay: 5_000 },
                removeOnComplete: { age: 86_400, count: 1_000 },
                removeOnFail: { age: 604_800 },
              },
            }),
          }),
        ]
      : []),
    PrismaModule,
    CryptoModule,
    ObservabilityModule,
    HealthModule,
    AdminAgentModule,
    AdminDashboardModule,
    DisputesModule,
    NotificationsModule,
    CheckoutModule,
    OrdersModule,
    MediaModule,
    PosModule,
    MarketsModule,
    StripeModule,
    TenantsModule,
    B2bModule,
    LogisticsModule,
    ContentModule,
    DiscoveryModule,
    AvailabilityModule,
    CateringModule,
    AnalyticsModule,
    IntelligenceModule,
    LoyaltyModule,
    FinancialModule,
    SupplierAnalyticsModule,
    VendorNetworkModule,
  ],
})
export class AppModule {}
