import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { FlashPromoController } from './flash-promo.controller';
import { FlashPromoService } from './flash-promo.service';
import { V2vConnectionsController } from './v2v-connections.controller';
import { V2vConnectionsService } from './v2v-connections.service';

/**
 * Phase 83 — vendor network expansion:
 * 83a classification helpers, 83b V2V connections, 83f flash promo.
 */
@Module({
  imports: [PrismaModule],
  controllers: [V2vConnectionsController, FlashPromoController],
  providers: [V2vConnectionsService, FlashPromoService],
  exports: [V2vConnectionsService, FlashPromoService],
})
export class VendorNetworkModule {}
