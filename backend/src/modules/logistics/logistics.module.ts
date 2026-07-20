import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { LogisticsService } from './logistics.service';
import { RegionalFreightCarrierClient } from './regional-freight-carrier.client';

@Module({
  imports: [PrismaModule],
  providers: [LogisticsService, RegionalFreightCarrierClient],
  exports: [LogisticsService, RegionalFreightCarrierClient],
})
export class LogisticsModule {}
