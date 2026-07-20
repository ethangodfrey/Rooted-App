import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ElasticsearchClientService } from './elasticsearch-client.service';
import {
  US_COUNTRY_CODE,
  validateUsWholesaleIndexGeo,
} from './us-geo.util';

export type WholesaleProductIndexDocument = {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  packagingUnit: string;
  moq: number;
  unitPriceCents: number;
  availableQuantity: number;
  saleModePreference: 'WHOLESALE_ONLY' | 'RETAIL_ONLY' | 'BOTH';
  status: string;
  updatedAt: string;
  /** Free-text vendor.country — validated to US before index write. */
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Pushes wholesale SKU documents to Elasticsearch on catalog create/update.
 * Phase 10: denormalizes US vendor geo_point + country_code.
 * Telemetry: GEO_FILTER_ENABLED, ELASTICSEARCH_SYNC_COMPLETED
 */
@Injectable()
export class WholesaleProductIndexerService implements OnModuleInit {
  private readonly logger = new Logger(WholesaleProductIndexerService.name);
  private mappingReady = false;

  constructor(private readonly elastic: ElasticsearchClientService) {}

  onModuleInit(): void {
    this.logger.log('GEO_FILTER_ENABLED COUNTRY_CODE=US');
    void this.ensureGeoMapping();
  }

  /**
   * Ensure wholesale index mapping includes geo_point + country_code keyword.
   * Safe no-op when Elasticsearch is disabled.
   */
  async ensureGeoMapping(): Promise<void> {
    const client = this.elastic.getClient();
    if (!client || this.mappingReady) return;

    const index = this.elastic.wholesaleIndex();
    const properties = {
      product_id: { type: 'keyword' as const },
      vendor_id: { type: 'keyword' as const },
      name: { type: 'text' as const },
      description: { type: 'text' as const },
      packaging_unit: { type: 'text' as const },
      moq: { type: 'integer' as const },
      unit_price_cents: { type: 'integer' as const },
      available_quantity: { type: 'integer' as const },
      sale_mode_preference: { type: 'keyword' as const },
      status: { type: 'keyword' as const },
      updated_at: { type: 'date' as const },
      country_code: { type: 'keyword' as const },
      location: { type: 'geo_point' as const },
    };

    try {
      const exists = await client.indices.exists({ index });
      if (!exists) {
        await client.indices.create({
          index,
          mappings: { properties },
        });
        this.logger.log(
          `ELASTICSEARCH_INDEX_CREATED INDEX=${index} GEO_POINT=1 COUNTRY_CODE=1`,
        );
      } else {
        await client.indices.putMapping({
          index,
          properties: {
            country_code: properties.country_code,
            location: properties.location,
            sale_mode_preference: properties.sale_mode_preference,
          },
        });
        this.logger.log(
          `ELASTICSEARCH_GEO_MAPPING_READY INDEX=${index} COUNTRY_CODE=US`,
        );
      }
      this.mappingReady = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `ELASTICSEARCH_GEO_MAPPING_SKIPPED INDEX=${index} ERROR=${message}`,
      );
    }
  }

  async indexProduct(doc: WholesaleProductIndexDocument): Promise<{
    SYNCED: boolean;
    SKIPPED_REASON: string | null;
  }> {
    const geo = validateUsWholesaleIndexGeo({
      country: doc.country,
      latitude: doc.latitude,
      longitude: doc.longitude,
    });

    if (!geo.OK) {
      this.logger.log(
        `ELASTICSEARCH_SYNC_SKIPPED REASON=${geo.REASON} ID=${doc.id} VENDOR=${doc.vendorId}`,
      );
      return { SYNCED: false, SKIPPED_REASON: geo.REASON };
    }

    const client = this.elastic.getClient();
    if (!client) {
      this.logger.log(
        `ELASTICSEARCH_SYNC_SKIPPED REASON=NODE_UNSET ID=${doc.id} VENDOR=${doc.vendorId}`,
      );
      return { SYNCED: false, SKIPPED_REASON: 'NODE_UNSET' };
    }

    await this.ensureGeoMapping();

    try {
      const document: Record<string, unknown> = {
        product_id: doc.id,
        vendor_id: doc.vendorId,
        name: doc.name,
        description: doc.description,
        packaging_unit: doc.packagingUnit,
        moq: doc.moq,
        unit_price_cents: doc.unitPriceCents,
        available_quantity: doc.availableQuantity,
        sale_mode_preference: doc.saleModePreference,
        status: doc.status,
        updated_at: doc.updatedAt,
        country_code: geo.COUNTRY_CODE,
      };

      if (geo.LATITUDE != null && geo.LONGITUDE != null) {
        document.location = {
          lat: geo.LATITUDE,
          lon: geo.LONGITUDE,
        };
      }

      await client.index({
        index: this.elastic.wholesaleIndex(),
        id: doc.id,
        document,
        refresh: false,
      });
      this.logger.log(
        `ELASTICSEARCH_SYNC_COMPLETED ID=${doc.id} VENDOR=${doc.vendorId} INDEX=${this.elastic.wholesaleIndex()} COUNTRY_CODE=${US_COUNTRY_CODE} SALE_MODE=${doc.saleModePreference} HAS_GEO=${geo.LATITUDE != null ? '1' : '0'}`,
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
