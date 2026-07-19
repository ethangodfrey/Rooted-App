import { Injectable, Logger } from '@nestjs/common';
import { WholesaleProductStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import {
  countBoostedHits,
  rankWholesaleHitsByConnectedVendors,
} from './wholesale-ranking.util';

export type WholesaleDiscoveryHit = {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  packagingUnit: string;
  moq: number;
  unitPriceCents: number;
  availableQuantity: number;
  status: string;
  score: number;
  CONNECTED_WHOLESALER: boolean;
};

/**
 * Wholesale discovery search with CONNECTED_WHOLESALERS boost.
 * Uses Elasticsearch when configured; otherwise Prisma ILIKE fallback.
 * Telemetry: RANKING_ALGORITHM_OPTIMIZED
 */
@Injectable()
export class WholesaleDiscoverySearchService {
  private readonly logger = new Logger(WholesaleDiscoverySearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elastic: ElasticsearchClientService,
  ) {}

  async search(params: {
    sessionVendorId: string;
    query: string;
    connectedVendorIds: string[];
    limit?: number;
  }): Promise<{
    HITS: WholesaleDiscoveryHit[];
    SOURCE: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK';
    BOOSTED_COUNT: number;
  }> {
    const limit = Math.min(Math.max(params.limit ?? 40, 1), 100);
    const q = params.query.trim();
    const connected = new Set(params.connectedVendorIds);

    const raw =
      this.elastic.isEnabled() && q.length > 0
        ? await this.searchElastic(q, limit)
        : await this.searchPostgres(q, limit);

    const ranked = rankWholesaleHitsByConnectedVendors(raw, connected).map(
      (hit) => ({
        ...hit,
        CONNECTED_WHOLESALER: connected.has(hit.vendorId),
      }),
    );
    const boosted = countBoostedHits(ranked, connected);

    this.logger.log(
      `RANKING_ALGORITHM_OPTIMIZED SESSION_VENDOR=${params.sessionVendorId} QUERY_LEN=${q.length} HITS=${ranked.length} BOOSTED=${boosted} SOURCE=${this.elastic.isEnabled() ? 'ELASTICSEARCH' : 'POSTGRES_FALLBACK'}`,
    );

    return {
      HITS: ranked,
      SOURCE: this.elastic.isEnabled() ? 'ELASTICSEARCH' : 'POSTGRES_FALLBACK',
      BOOSTED_COUNT: boosted,
    };
  }

  private async searchElastic(
    query: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      vendorId: string;
      name: string;
      description: string | null;
      packagingUnit: string;
      moq: number;
      unitPriceCents: number;
      availableQuantity: number;
      status: string;
      score: number;
    }>
  > {
    const client = this.elastic.getClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.elastic.wholesaleIndex(),
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['name^3', 'description', 'packaging_unit'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [{ term: { status: 'ACTIVE' } }],
          },
        },
      });

      const hits = response.hits.hits ?? [];
      return hits
        .map((hit) => {
          const src = (hit._source ?? {}) as Record<string, unknown>;
          const id = String(src.product_id ?? hit._id ?? '');
          const vendorId = String(src.vendor_id ?? '');
          if (!id || !vendorId) return null;
          return {
            id,
            vendorId,
            name: String(src.name ?? ''),
            description:
              src.description == null ? null : String(src.description),
            packagingUnit: String(src.packaging_unit ?? ''),
            moq: Number(src.moq ?? 0),
            unitPriceCents: Number(src.unit_price_cents ?? 0),
            availableQuantity: Number(src.available_quantity ?? 0),
            status: String(src.status ?? 'ACTIVE'),
            score: typeof hit._score === 'number' ? hit._score : 0,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ELASTICSEARCH_SEARCH_FAILED ERROR=${message}`);
      return this.searchPostgres(query, limit);
    }
  }

  private async searchPostgres(query: string, limit: number) {
    const where =
      query.length > 0
        ? {
            status: WholesaleProductStatus.ACTIVE,
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              {
                description: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
              {
                packagingUnit: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : { status: WholesaleProductStatus.ACTIVE };

    const rows = await this.prisma.wholesaleProduct.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row, index) => ({
      id: row.id,
      vendorId: row.vendorId,
      name: row.name,
      description: row.description,
      packagingUnit: row.packagingUnit,
      moq: row.moq,
      unitPriceCents: row.unitPriceCents,
      availableQuantity: row.availableQuantity,
      status: row.status,
      // Preserve relative freshness as a soft score when ES is offline.
      score: Math.max(0, limit - index),
    }));
  }
}
