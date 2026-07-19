import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { VendorConnectionsController } from './vendor-connections.controller';
import { VendorConnectionsService } from './vendor-connections.service';
import { WholesaleProductsController } from './wholesale-products.controller';
import { WholesaleProductsService } from './wholesale-products.service';

@Module({
  imports: [PrismaModule],
  controllers: [VendorConnectionsController, WholesaleProductsController],
  providers: [VendorConnectionsService, WholesaleProductsService],
  exports: [VendorConnectionsService, WholesaleProductsService],
})
export class B2bModule {}
