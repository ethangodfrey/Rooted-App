import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, WholesaleProductStatus } from '@prisma/client';
import { boundingBoxDegrees } from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';
import { ElasticsearchClientService } from './elasticsearch-client.service';
import {
  haversineDistanceMiles,
  US_COUNTRY_CODE,
} from './us-geo.util';
import {
  buildScoreCompositionLog,
  CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
  countBoostedHits,
  PROXIMITY_SCORE_WEIGHT,
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
  saleModePreference: 'WHOLESALE_ONLY' | 'RETAIL_ONLY' | 'BOTH';
  status: string;
  /** Final hybrid score (base * connected * proximity). */
  score: number;
  baseScore: number;
  boostApplied: number;
  proximityBoost: number;
  CONNECTED_WHOLESALER: boolean;
  distanceMiles: number | null;
};

export type WholesaleProximityParams = {
  latitude: number;
  longitude: number;
  radiusMiles: number;
};

type SaleModePreference = 'WHOLESALE_ONLY' | 'RETAIL_ONLY' | 'BOTH';

type RawDiscoveryHit = {
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
  score: number;
  distanceMiles: number | null;
};

/**
 * Wholesale discovery search with CONNECTED_WHOLESALERS + proximity hybrid ranking.
 * Uses Elasticsearch when configured; otherwise Prisma/SQL fallback (same boosts).
 * Telemetry: RANKING_ALGORITHM_REFINED, RADIUS_SEARCH_OPTIMIZED, SEARCH_SCORE_CALCULATED
 */
@Injectable()
export class WholesaleDiscoverySearchService implements OnModuleInit {
  private readonly logger = new Logger(WholesaleDiscoverySearchService.name);
  private readonly debugRanking: boolean;
  private readonly boostMultiplier: number;
  private readonly proximityWeight: number;

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
    const proximityConfigured = Number(
      this.config.get<string>('PROXIMITY_SCORE_WEIGHT'),
    );
    this.proximityWeight =
      Number.isFinite(proximityConfigured) && proximityConfigured >= 0
        ? proximityConfigured
        : PROXIMITY_SCORE_WEIGHT;
  }

  onModuleInit(): void {
    this.logger.log(
      `RANKING_ALGORITHM_REFINED MULTIPLIER=${this.boostMultiplier} PROXIMITY_WEIGHT=${this.proximityWeight} DEBUG=${this.debugRanking ? '1' : '0'}`,
    );
  }

  async search(params: {
    sessionVendorId: string;
    query: string;
    connectedVendorIds: string[];
    saleModePreference?: SaleModePreference[];
    limit?: number;
    proximity?: WholesaleProximityParams | null;
  }): Promise<{
    HITS: WholesaleDiscoveryHit[];
    SOURCE: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK';
    BOOSTED_COUNT: number;
    MULTIPLIER: number;
    PROXIMITY_WEIGHT: number;
    COUNTRY_CODE: typeof US_COUNTRY_CODE | null;
    RADIUS_MILES: number | null;
  }> {
    const limit = Math.min(Math.max(params.limit ?? 40, 1), 100);
    const q = params.query.trim();
    const connected = new Set(params.connectedVendorIds);
    const proximity = params.proximity ?? null;
    const saleModePreference: SaleModePreference[] =
      params.saleModePreference?.length
        ? params.saleModePreference
        : ['WHOLESALE_ONLY', 'BOTH'];
    const source: 'ELASTICSEARCH' | 'POSTGRES_FALLBACK' =
      this.elastic.isEnabled() && q.length > 0
        ? 'ELASTICSEARCH'
        : 'POSTGRES_FALLBACK';

    if (proximity) {
      this.logger.log(
        `RADIUS_SEARCH_OPTIMIZED LAT=${proximity.latitude} LNG=${proximity.longitude} RADIUS_MI=${proximity.radiusMiles} COUNTRY_CODE=${US_COUNTRY_CODE} SOURCE=${source}`,
      );
    }

    const raw =
      source === 'ELASTICSEARCH'
        ? await this.searchElastic(q, limit, proximity, saleModePreference)
        : await this.searchPostgres(q, limit, proximity, saleModePreference);

    const ranked = rankWholesaleHitsByConnectedVendors(
      raw,
      connected,
      this.boostMultiplier,
      {
        radiusMiles: proximity?.radiusMiles ?? null,
        proximityWeight: this.proximityWeight,
      },
    );

    if (this.debugRanking) {
      for (const hit of ranked) {
        this.logger.log(
          buildScoreCompositionLog({
            ID: hit.id,
            VENDOR_ID: hit.vendorId,
            BASE_SCORE: hit.baseScore,
            BOOST_APPLIED: hit.boostApplied,
            PROXIMITY_BOOST: hit.proximityBoost,
            FINAL_SCORE: hit.score,
            CONNECTED_WHOLESALER: hit.CONNECTED_WHOLESALER,
            DISTANCE_MILES: hit.distanceMiles,
          }),
        );
      }
    }

    const boosted = countBoostedHits(ranked, connected);

    this.logger.log(
      `RANKING_ALGORITHM_REFINED SESSION_VENDOR=${params.sessionVendorId} QUERY_LEN=${q.length} HITS=${ranked.length} BOOSTED=${boosted} MULTIPLIER=${this.boostMultiplier} PROXIMITY_WEIGHT=${this.proximityWeight} SOURCE=${source}${proximity ? ` RADIUS_MI=${proximity.radiusMiles}` : ''}`,
    );

    return {
      HITS: ranked,
      SOURCE: source,
      BOOSTED_COUNT: boosted,
      MULTIPLIER: this.boostMultiplier,
      PROXIMITY_WEIGHT: this.proximityWeight,
      COUNTRY_CODE: proximity ? US_COUNTRY_CODE : null,
      RADIUS_MILES: proximity?.radiusMiles ?? null,
    };
  }

  private async searchElastic(
    query: string,
    limit: number,
    proximity: WholesaleProximityParams | null,
    saleModePreference: SaleModePreference[],
  ): Promise<RawDiscoveryHit[]> {
    const client = this.elastic.getClient();
    if (!client) return [];

    const filter: Record<string, unknown>[] = [
      { term: { status: 'ACTIVE' } },
      { terms: { sale_mode_preference: saleModePreference } },
    ];

    if (proximity) {
      filter.push({ term: { country_code: US_COUNTRY_CODE } });
      filter.push({
        geo_distance: {
          distance: `${proximity.radiusMiles}mi`,
          location: {
            lat: proximity.latitude,
            lon: proximity.longitude,
          },
        },
      });
    }

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
            filter,
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

          let distanceMiles: number | null = null;
          if (proximity) {
            const location = src.location as
              | { lat?: number; lon?: number }
              | undefined;
            if (
              location &&
              Number.isFinite(location.lat) &&
              Number.isFinite(location.lon)
            ) {
              distanceMiles = haversineDistanceMiles(
                proximity.latitude,
                proximity.longitude,
                Number(location.lat),
                Number(location.lon),
              );
            }
          }

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
            saleModePreference: String(
              src.sale_mode_preference ?? 'WHOLESALE_ONLY',
            ) as SaleModePreference,
            status: String(src.status ?? 'ACTIVE'),
            score: typeof hit._score === 'number' ? hit._score : 0,
            distanceMiles,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ELASTICSEARCH_SEARCH_FAILED ERROR=${message}`);
      return this.searchPostgres(query, limit, proximity, saleModePreference);
    }
  }

  private async searchPostgres(
    query: string,
    limit: number,
    proximity: WholesaleProximityParams | null,
    saleModePreference: SaleModePreference[],
  ): Promise<RawDiscoveryHit[]> {
    if (!proximity) {
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
              saleModePreference: { in: saleModePreference },
            }
          : {
              status: WholesaleProductStatus.ACTIVE,
              saleModePreference: { in: saleModePreference },
            };

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
        saleModePreference: row.saleModePreference,
        status: row.status,
        score: Math.max(0, limit - index),
        distanceMiles: null,
      }));
    }

    const { latitude, longitude, radiusMiles } = proximity;
    const box = boundingBoxDegrees(latitude, longitude, radiusMiles);
    const pattern = query.length > 0 ? `%${query}%` : null;

    type RawRow = {
      id: string;
      vendor_id: string;
      name: string;
      description: string | null;
      packaging_unit: string;
      moq: number;
      unit_price_cents: number;
      available_quantity: number;
      sale_mode_preference: SaleModePreference;
      status: string;
      distance_miles: number;
    };

    const rows = await this.prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        wp.id,
        wp.vendor_id,
        wp.name,
        wp.description,
        wp.packaging_unit,
        wp.moq,
        wp.unit_price_cents,
        wp.available_quantity,
        wp.sale_mode_preference::text AS sale_mode_preference,
        wp.status::text AS status,
        (
          3959 * acos(
            LEAST(
              1.0,
              GREATEST(
                -1.0,
                cos(radians(${latitude}))
                  * cos(radians(v.latitude::float8))
                  * cos(radians(v.longitude::float8) - radians(${longitude}))
                  + sin(radians(${latitude}))
                  * sin(radians(v.latitude::float8))
              )
            )
          )
        ) AS distance_miles
      FROM public.wholesale_products wp
      INNER JOIN public.vendors v ON v.id = wp.vendor_id
      WHERE wp.status = 'ACTIVE'::public.wholesale_product_status
        AND wp.sale_mode_preference::text IN (${Prisma.join(
          saleModePreference.map((mode) => Prisma.sql`${mode}`),
          ', ',
        )})
        AND v.latitude IS NOT NULL
        AND v.longitude IS NOT NULL
        AND (
          v.country IS NULL
          OR upper(trim(v.country)) IN (
            'US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA',
            'U.S.', 'U.S.A.', 'U.S.A', 'U.S'
          )
        )
        AND v.latitude BETWEEN ${box.minLat} AND ${box.maxLat}
        AND v.longitude BETWEEN ${box.minLng} AND ${box.maxLng}
        AND (
          3959 * acos(
            LEAST(
              1.0,
              GREATEST(
                -1.0,
                cos(radians(${latitude}))
                  * cos(radians(v.latitude::float8))
                  * cos(radians(v.longitude::float8) - radians(${longitude}))
                  + sin(radians(${latitude}))
                  * sin(radians(v.latitude::float8))
              )
            )
          )
        ) <= ${radiusMiles}
        AND (
          ${pattern}::text IS NULL
          OR wp.name ILIKE ${pattern}
          OR COALESCE(wp.description, '') ILIKE ${pattern}
          OR wp.packaging_unit ILIKE ${pattern}
        )
      ORDER BY distance_miles ASC, wp.updated_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row, index) => ({
      id: row.id,
      vendorId: row.vendor_id,
      name: row.name,
      description: row.description,
      packagingUnit: row.packaging_unit,
      moq: row.moq,
      unitPriceCents: row.unit_price_cents,
      availableQuantity: row.available_quantity,
      saleModePreference: row.sale_mode_preference,
      status: row.status,
      score: Math.max(0, limit - index),
      distanceMiles: Number(row.distance_miles),
    }));
  }
}
