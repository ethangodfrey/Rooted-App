import { Injectable, Logger } from '@nestjs/common';

import { ElasticsearchClientService } from './elasticsearch-client.service';

export type WholesaleProductIndexDocument = {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  packagingUnit: string;
  moq: number;
  unitPriceCents: number;
  availableQuantity: number;
  status: string;
  updatedAt: string;
};

/**
 * Pushes wholesale SKU documents to Elasticsearch on catalog create/update.
 * Telemetry: ELASTICSEARCH_SYNC_COMPLETED
 */
@Injectable()
export class WholesaleProductIndexerService {
  private readonly logger = new Logger(WholesaleProductIndexerService.name);

  constructor(private readonly elastic: ElasticsearchClientService) {}

  async indexProduct(doc: WholesaleProductIndexDocument): Promise<{
    SYNCED: boolean;
    SKIPPED_REASON: string | null;
  }> {
    const client = this.elastic.getClient();
    if (!client) {
      this.logger.log(
        `ELASTICSEARCH_SYNC_SKIPPED REASON=NODE_UNSET ID=${doc.id} VENDOR=${doc.vendorId}`,
      );
      return { SYNCED: false, SKIPPED_REASON: 'NODE_UNSET' };
    }

    try {
      await client.index({
        index: this.elastic.wholesaleIndex(),
        id: doc.id,
        document: {
          product_id: doc.id,
          vendor_id: doc.vendorId,
          name: doc.name,
          description: doc.description,
          packaging_unit: doc.packagingUnit,
          moq: doc.moq,
          unit_price_cents: doc.unitPriceCents,
          available_quantity: doc.availableQuantity,
          status: doc.status,
          updated_at: doc.updatedAt,
        },
        refresh: false,
      });
      this.logger.log(
        `ELASTICSEARCH_SYNC_COMPLETED ID=${doc.id} VENDOR=${doc.vendorId} INDEX=${this.elastic.wholesaleIndex()}`,
      );
      return { SYNCED: true, SKIPPED_REASON: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ELASTICSEARCH_SYNC_FAILED ID=${doc.id} VENDOR=${doc.vendorId} ERROR=${message}`,
      );
      return { SYNCED: false, SKIPPED_REASON: 'SYNC_FAILED' };
    }
  }
}
