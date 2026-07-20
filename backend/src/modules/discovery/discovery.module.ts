import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { DiscoveryController } from './discovery.controller';
import { MeetTheMakersService } from './meet-the-makers.service';
import { UserEventsService } from './user-events.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiscoveryController],
  providers: [MeetTheMakersService, UserEventsService],
  exports: [MeetTheMakersService, UserEventsService],
})
export class DiscoveryModule {}
