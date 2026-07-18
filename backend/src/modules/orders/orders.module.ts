import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersHandoffService } from './orders-handoff.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersHandoffService],
  exports: [OrdersHandoffService],
})
export class OrdersModule {}
