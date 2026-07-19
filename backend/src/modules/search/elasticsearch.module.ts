import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import { WholesaleDiscoverySearchService } from './wholesale-discovery-search.service';
import { WholesaleProductIndexerService } from './wholesale-product-indexer.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ElasticsearchClientService,
    WholesaleProductIndexerService,
    WholesaleDiscoverySearchService,
  ],
  exports: [
    ElasticsearchClientService,
    WholesaleProductIndexerService,
    WholesaleDiscoverySearchService,
  ],
})
export class ElasticsearchModule {}
