import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AdminMarketsController } from './admin-markets.controller';
import { MarketsGooglePlacesService } from './markets-google-places.service';
import { MarketsLinksService } from './markets-links.service';
import { PublicMarketsController } from './public-markets.controller';
import { MarketsAgentService } from './markets-agent.service';
import { MarketsAiService } from './markets-ai.service';
import { MarketsDiscoveryService } from './markets-discovery.service';
import { MarketsEnrichmentService } from './markets-enrichment.service';
import { MarketsImageService } from './markets-image.service';
import { MarketsImageVerifyService } from './markets-image-verify.service';
import { MarketsNominatimService } from './markets-nominatim.service';
import { MarketsScheduleAiService } from './markets-schedule-ai.service';
import { MarketsSchedulerService } from './markets-scheduler.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMarketsController, PublicMarketsController],
  providers: [
    MarketsGooglePlacesService,
    MarketsLinksService,
    MarketsNominatimService,
    MarketsDiscoveryService,
    MarketsAiService,
    MarketsImageService,
    MarketsImageVerifyService,
    MarketsEnrichmentService,
    MarketsScheduleAiService,
    MarketsAgentService,
    MarketsSchedulerService,
  ],
  exports: [MarketsAgentService, MarketsEnrichmentService, MarketsScheduleAiService, MarketsLinksService],
})
export class MarketsModule {}
