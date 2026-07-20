import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { DisputesModule } from '../disputes/disputes.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [PrismaModule, DisputesModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule {}
