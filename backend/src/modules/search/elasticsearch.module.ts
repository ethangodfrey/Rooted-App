import { Module } from '@nestjs/common';

import { ElasticsearchClientService } from './elasticsearch-client.service';
import { WholesaleProductIndexerService } from './wholesale-product-indexer.service';

@Module({
  providers: [ElasticsearchClientService, WholesaleProductIndexerService],
  exports: [ElasticsearchClientService, WholesaleProductIndexerService],
})
export class ElasticsearchModule {}
