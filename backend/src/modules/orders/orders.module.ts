import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersCreateService } from './orders-create.service';
import { OrdersHandoffService } from './orders-handoff.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersCreateService, OrdersHandoffService],
  exports: [OrdersCreateService, OrdersHandoffService],
})
export class OrdersModule {}
