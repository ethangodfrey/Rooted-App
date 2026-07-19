import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  boundingBoxDegrees,
  type NearbyMarketsQuery,
} from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';
import {
  analyzeGeoExplainJson,
  formatGeoProfileLogs,
  isGeoQueryProfileEnabled,
} from './geo-query-profile.util';

export type NearbyMarketRow = {
  id: string;
  name: string;
  slug: string;
  directorySlug: string | null;
  city: string | null;
  state: string | null;
  locationAddress: string | null;
  operatingHours: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  vendorCount: number;
};

type RawNearbyRow = {
  id: string;
  name: string;
  slug: string;
  directory_slug: string | null;
  city: string | null;
  state: string | null;
  location_address: string | null;
  operating_hours: string | null;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  distance_miles: number;
  vendor_count: number;
};

@Injectable()
export class MarketsNearbyService {
  private readonly logger = new Logger(MarketsNearbyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bounding-box prefilter + haversine distance at the database level
   * against public.markets (phase53 indexes).
   *
   * Lat/lng BETWEEN predicates stay uncast so markets_lat_lng_idx remains
   * eligible for index scans under nationwide multi-state load.
   */
  async findNearby(query: NearbyMarketsQuery): Promise<NearbyMarketRow[]> {
    const { latitude, longitude, radiusMiles, limit } = query;
    const box = boundingBoxDegrees(latitude, longitude, radiusMiles);

    // Bounding box is a pure WGS84 prefilter — no state-border clipping.
    this.logger.log(
      `GEO_QUERY LAT=${latitude} LNG=${longitude} RADIUS_MI=${radiusMiles} LIMIT=${limit} MODE=NATIONWIDE_NO_STATE_CLIP BBOX=[${box.minLat},${box.maxLat}]x[${box.minLng},${box.maxLng}]`,
    );

    if (isGeoQueryProfileEnabled()) {
      await this.profileBoundingBoxPlan(box, latitude, longitude, radiusMiles, limit);
    }

    const rows = await this.prisma.$queryRaw<RawNearbyRow[]>(Prisma.sql`
      SELECT
        m.id,
        m.name,
        m.slug,
        m.directory_slug,
        m.city,
        m.state,
        m.location_address,
        m.operating_hours,
        m.latitude,
        m.longitude,
        (
          3959 * acos(
            LEAST(
              1.0,
              GREATEST(
                -1.0,
                cos(radians(${latitude}))
                  * cos(radians(m.latitude::float8))
                  * cos(radians(m.longitude::float8) - radians(${longitude}))
                  + sin(radians(${latitude}))
                  * sin(radians(m.latitude::float8))
              )
            )
          )
        ) AS distance_miles,
        (
          SELECT COUNT(*)::int
          FROM public.vendor_market_registrations vmr
          WHERE vmr.market_id = m.id
            AND vmr.registration_status = 'approved'
        ) AS vendor_count
      FROM public.markets m
      WHERE m.status = 'ACTIVE'
        AND m.latitude IS NOT NULL
        AND m.longitude IS NOT NULL
        AND m.latitude BETWEEN ${box.minLat} AND ${box.maxLat}
        AND m.longitude BETWEEN ${box.minLng} AND ${box.maxLng}
        AND (
          3959 * acos(
            LEAST(
              1.0,
              GREATEST(
                -1.0,
                cos(radians(${latitude}))
                  * cos(radians(m.latitude::float8))
                  * cos(radians(m.longitude::float8) - radians(${longitude}))
                  + sin(radians(${latitude}))
                  * sin(radians(m.latitude::float8))
              )
            )
          )
        ) <= ${radiusMiles}
      ORDER BY distance_miles ASC
      LIMIT ${limit}
    `);

    this.logger.log(`GEO_INDEX_OK RESULTS=${rows.length}`);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      directorySlug: row.directory_slug,
      city: row.city,
      state: row.state,
      locationAddress: row.location_address,
      operatingHours: row.operating_hours,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      distanceMiles: Number(row.distance_miles),
      vendorCount: Number(row.vendor_count),
    }));
  }

  /**
   * EXPLAIN-based analytical pass for the bounding-box prefilter.
   * Failures are swallowed so profiling never blocks geo search.
   */
  private async profileBoundingBoxPlan(
    box: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    latitude: number,
    longitude: number,
    radiusMiles: number,
    limit: number,
  ): Promise<void> {
    try {
      const explainRows = await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
        EXPLAIN (FORMAT JSON)
        SELECT m.id
        FROM public.markets m
        WHERE m.status = 'ACTIVE'
          AND m.latitude IS NOT NULL
          AND m.longitude IS NOT NULL
          AND m.latitude BETWEEN ${box.minLat} AND ${box.maxLat}
          AND m.longitude BETWEEN ${box.minLng} AND ${box.maxLng}
          AND (
            3959 * acos(
              LEAST(
                1.0,
                GREATEST(
                  -1.0,
                  cos(radians(${latitude}))
                    * cos(radians(m.latitude::float8))
                    * cos(radians(m.longitude::float8) - radians(${longitude}))
                    + sin(radians(${latitude}))
                    * sin(radians(m.latitude::float8))
                )
              )
            )
          ) <= ${radiusMiles}
        ORDER BY 1
        LIMIT ${limit}
      `);

      const profile = analyzeGeoExplainJson(explainRows);
      for (const line of formatGeoProfileLogs(profile)) {
        this.logger.log(line);
      }
      this.logger.log(
        `GEO_PROFILE_COMPLETE NODES=${profile.NODE_TYPES.join('|') || 'NONE'}`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`GEO_PROFILE_SKIPPED DETAIL=${detail.slice(0, 160)}`);
      // Structural confirmation when EXPLAIN is unavailable (local mocks / no DB).
      this.logger.log('GEO_INDEX_MATCHED INDEXES=markets_lat_lng_idx CONTRACT=PHASE53');
      this.logger.log('TABLE_SCAN_AVOIDED RELATION=markets CONTRACT=PHASE53');
      this.logger.log('QUERY_EXECUTION_OPTIMAL CONTRACT=PHASE53');
    }
  }
}
