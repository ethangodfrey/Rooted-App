import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WholesaleProductStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import {
  buildScoreCompositionLog,
  CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
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
  /** Final hybrid score (base relevance * optional connected multiplier). */
  score: number;
  baseScore: number;
  boostApplied: number;
  CONNECTED_WHOLESALER: boolean;
};

/**
 * Wholesale discovery search with multiplicative CONNECTED_WHOLESALERS boost.
 * Uses Elasticsearch when configured; otherwise Prisma ILIKE fallback (same boost).
 * Telemetry: RANKING_ALGORITHM_REFINED, SEARCH_SCORE_CALCULATED
 */
@Injectable()
export class WholesaleDiscoverySearchService implements OnModuleInit {
  private readonly logger = new Logger(WholesaleDiscoverySearchService.name);
  private readonly debugRanking: boolean;
  private readonly boostMultiplier: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly elastic: ElasticsearchClientService,
    private readonly config: ConfigService,
  ) {
    this.debugRanking =
      (this.config.get<string>('DEBUG_SEARCH_RANKING') ?? '')
        .trim()
        .toLowerCase() === 'true';
    const configured = Number(
      this.config.get<string>('CONNECTED_WHOLESALER_SCORE_MULTIPLIER'),
    );
    this.boostMultiplier =
      Number.isFinite(configured) && configured > 0
        ? configured
        : CONNECTED_WHOLESALER_SCORE_MULTIPLIER;
  }

  onModuleInit(): void {
    this.logger.log(
      `RANKING_ALGORITHM_REFINED MULTIPLIER=${this.boostMultiplier} DEBUG=${this.debugRanking ? '1' : '0'}`,
    );
  }

  async search(params: {
    sessionVendorId: string;
    query: string;
    connectedVendorIds: string[];
    limit?: number;
  }): Promise<{
    HITS: WholesaleDiscoveryHit[];
    SOURCE: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK';
    BOOSTED_COUNT: number;
    MULTIPLIER: number;
  }> {
    const limit = Math.min(Math.max(params.limit ?? 40, 1), 100);
    const q = params.query.trim();
    const connected = new Set(params.connectedVendorIds);
    const source: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK' =
      this.elastic.isEnabled() && q.length > 0
        ? 'ELASTICSEARCH'
        : 'POSTGRES_FALLBACK';

    const raw =
      source === 'ELASTICSEARCH'
        ? await this.searchElastic(q, limit)
        : await this.searchPostgres(q, limit);

    const ranked = rankWholesaleHitsByConnectedVendors(
      raw,
      connected,
      this.boostMultiplier,
    );

    if (this.debugRanking) {
      for (const hit of ranked) {
        this.logger.log(
          buildScoreCompositionLog({
            ID: hit.id,
            VENDOR_ID: hit.vendorId,
            BASE_SCORE: hit.baseScore,
            BOOST_APPLIED: hit.boostApplied,
            FINAL_SCORE: hit.score,
            CONNECTED_WHOLESALER: hit.CONNECTED_WHOLESALER,
          }),
        );
      }
    }

    const boosted = countBoostedHits(ranked, connected);

    this.logger.log(
      `RANKING_ALGORITHM_REFINED SESSION_VENDOR=${params.sessionVendorId} QUERY_LEN=${q.length} HITS=${ranked.length} BOOSTED=${boosted} MULTIPLIER=${this.boostMultiplier} SOURCE=${source}`,
    );

    return {
      HITS: ranked,
      SOURCE: source,
      BOOSTED_COUNT: boosted,
      MULTIPLIER: this.boostMultiplier,
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
      // Soft relevance proxy for ILIKE path (same multiplicative boost applied later).
      score: Math.max(0, limit - index),
    }));
  }
}
