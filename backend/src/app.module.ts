import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { CryptoModule } from './common/crypto/crypto.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { isPosQueuesEnabledFromEnv } from './common/redis/pos-queues-enabled';
import { resolveRedisConnection } from './common/redis/redis-connection';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AdminAgentModule } from './modules/admin-agent/admin-agent.module';
import { MarketsModule } from './modules/markets/markets.module';
import { PosModule } from './modules/pos/pos.module';

const posQueuesEnabled = isPosQueuesEnabledFromEnv();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    PosModule,
    MarketsModule,
  ],
})
export class AppModule {}
