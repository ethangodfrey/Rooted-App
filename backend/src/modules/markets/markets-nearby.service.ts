import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  boundingBoxDegrees,
  type NearbyMarketsQuery,
} from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';

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
   */
  async findNearby(query: NearbyMarketsQuery): Promise<NearbyMarketRow[]> {
    const { latitude, longitude, radiusMiles, limit } = query;
    const box = boundingBoxDegrees(latitude, longitude, radiusMiles);

    this.logger.log(
      `GEO_QUERY LAT=${latitude} LNG=${longitude} RADIUS_MI=${radiusMiles} LIMIT=${limit}`,
    );

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
        AND m.latitude::float8 BETWEEN ${box.minLat} AND ${box.maxLat}
        AND m.longitude::float8 BETWEEN ${box.minLng} AND ${box.maxLng}
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
}
