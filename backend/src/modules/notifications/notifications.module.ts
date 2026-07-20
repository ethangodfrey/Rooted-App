import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { MarketNotificationScheduler } from './market-notification.scheduler';
import { MarketNotificationService } from './market-notification.service';

@Module({
  imports: [PrismaModule],
  providers: [MarketNotificationService, MarketNotificationScheduler],
  exports: [MarketNotificationService],
})
export class NotificationsModule {}
