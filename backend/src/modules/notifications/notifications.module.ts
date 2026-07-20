import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { MarketNotificationScheduler } from './market-notification.scheduler';
import { MarketNotificationService } from './market-notification.service';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    MarketNotificationService,
    MarketNotificationScheduler,
  ],
  exports: [NotificationService, MarketNotificationService],
})
export class NotificationsModule {}
