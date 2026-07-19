import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Query,
} from '@nestjs/common';
import { parseNearbyMarketsQuerySafe } from '@vendorly/env-config';

import { MarketsNearbyService } from './markets-nearby.service';

/**
 * Nationwide directory geo search.
 * GET /api/markets/nearby?latitude=&longitude=&radiusMiles=&limit=
 */
@Controller('api/markets')
export class MarketsNearbyController {
  constructor(private readonly nearby: MarketsNearbyService) {}

  @Get('nearby')
  @HttpCode(200)
  async nearbyMarkets(
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusMiles') radiusMiles?: string,
    @Query('radius_miles') radiusMilesSnake?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = parseNearbyMarketsQuerySafe({
      latitude,
      longitude,
      radiusMiles: radiusMiles ?? radiusMilesSnake,
      limit,
    });

    if (!parsed.OK) {
      throw new BadRequestException(parsed.ERROR);
    }

    const markets = await this.nearby.findNearby(parsed.DATA);

    return {
      STATUS: 'DIRECTORY_READY',
      GEO_INDEX_OK: true,
      QUERY: {
        LATITUDE: parsed.DATA.latitude,
        LONGITUDE: parsed.DATA.longitude,
        RADIUS_MILES: parsed.DATA.radiusMiles,
        LIMIT: parsed.DATA.limit,
      },
      COUNT: markets.length,
      MARKETS: markets.map((m) => ({
        ID: m.id,
        NAME: m.name,
        SLUG: m.slug,
        DIRECTORY_SLUG: m.directorySlug,
        CITY: m.city,
        STATE: m.state,
        ADDRESS: m.locationAddress,
        OPERATING_HOURS: m.operatingHours,
        LATITUDE: m.latitude,
        LONGITUDE: m.longitude,
        DISTANCE_MILES: Number(m.distanceMiles.toFixed(3)),
        VENDOR_COUNT: m.vendorCount,
      })),
    };
  }
}
