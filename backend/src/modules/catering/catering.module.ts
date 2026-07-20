import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AvailabilityModule } from '../availability/availability.module';
import { VendorCateringController } from './vendor-catering.controller';
import { VendorCateringService } from './vendor-catering.service';

@Module({
  imports: [PrismaModule, AvailabilityModule],
  controllers: [VendorCateringController],
  providers: [VendorCateringService],
  exports: [VendorCateringService],
})
export class CateringModule {}
