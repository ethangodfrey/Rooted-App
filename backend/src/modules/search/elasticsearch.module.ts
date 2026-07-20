import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import { PartitionAwareOrderIndexerService } from './partition-aware-order-indexer.service';
import { WholesaleDiscoverySearchService } from './wholesale-discovery-search.service';
import { WholesaleProductIndexerService } from './wholesale-product-indexer.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ElasticsearchClientService,
    WholesaleProductIndexerService,
    PartitionAwareOrderIndexerService,
    WholesaleDiscoverySearchService,
  ],
  exports: [
    ElasticsearchClientService,
    WholesaleProductIndexerService,
    PartitionAwareOrderIndexerService,
    WholesaleDiscoverySearchService,
  ],
})
export class ElasticsearchModule {}
