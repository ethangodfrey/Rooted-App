import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AdminMarketsController } from './admin-markets.controller';
import { MarketsDirectoryController } from './markets-directory.controller';
import { MarketsDirectoryService } from './markets-directory.service';
import { MarketsGooglePlacesService } from './markets-google-places.service';
import { MarketsLinksService } from './markets-links.service';
import { PublicMarketsController } from './public-markets.controller';
import { MarketsNearbyController } from './markets-nearby.controller';
import { MarketsNearbyService } from './markets-nearby.service';
import { MarketsAgentService } from './markets-agent.service';
import { MarketsAiService } from './markets-ai.service';
import { MarketsDiscoveryService } from './markets-discovery.service';
import { MarketsEnrichmentService } from './markets-enrichment.service';
import { MarketsImageService } from './markets-image.service';
import { MarketsImageVerifyService } from './markets-image-verify.service';
import { MarketsNominatimService } from './markets-nominatim.service';
import { MarketsClassifyAiService } from './markets-classify-ai.service';
import { MarketsScheduleAiService } from './markets-schedule-ai.service';
import { MarketsSchedulerService } from './markets-scheduler.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminMarketsController,
    PublicMarketsController,
    MarketsDirectoryController,
    MarketsNearbyController,
  ],
  providers: [
    MarketsNearbyService,
    MarketsGooglePlacesService,
    MarketsLinksService,
    MarketsNominatimService,
    MarketsDiscoveryService,
    MarketsAiService,
    MarketsImageService,
    MarketsImageVerifyService,
    MarketsEnrichmentService,
    MarketsScheduleAiService,
    MarketsClassifyAiService,
    MarketsAgentService,
    MarketsSchedulerService,
    MarketsDirectoryService,
  ],
  exports: [
    MarketsAgentService,
    MarketsEnrichmentService,
    MarketsScheduleAiService,
    MarketsClassifyAiService,
    MarketsLinksService,
    MarketsDirectoryService,
    MarketsNearbyService,
  ],
})
export class MarketsModule {}
