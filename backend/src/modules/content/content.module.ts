import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ContentContributionController } from './content-contribution.controller';
import { ContentContributionService } from './content-contribution.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentContributionController],
  providers: [ContentContributionService],
  exports: [ContentContributionService],
})
export class ContentModule {}
