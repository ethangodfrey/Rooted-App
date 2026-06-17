import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { isPosQueuesEnabledFromEnv } from '../../common/redis/pos-queues-enabled';
import { POS_SYNC_QUEUE } from '../pos/jobs/pos-queue.constants';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const posQueuesEnabled = isPosQueuesEnabledFromEnv();

@Module({
  imports: [
    ...(posQueuesEnabled ? [BullModule.registerQueue({ name: POS_SYNC_QUEUE })] : []),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
