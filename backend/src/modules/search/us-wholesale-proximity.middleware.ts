import {
  BadRequestException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { parseWholesaleProximitySearchQuerySafe } from '@vendorly/env-config';
import type { NextFunction, Request, Response } from 'express';

export type WholesaleUsGeoContext = {
  countryCode: 'US';
  proximityEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number | null;
  q: string;
  limit: number;
};

export type RequestWithWholesaleUsGeo = Request & {
  wholesaleUsGeo?: WholesaleUsGeoContext;
};

/**
 * Enforces country_code: US on all wholesale proximity queries.
 * Attaches validated geo context for the discovery search controller.
 * Telemetry: GEO_FILTER_ENABLED (when proximity params present)
 */
@Injectable()
export class UsWholesaleProximityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UsWholesaleProximityMiddleware.name);

  use(req: RequestWithWholesaleUsGeo, _res: Response, next: NextFunction): void {
    const query = (req.query ?? {}) as Record<string, unknown>;
    const parsed = parseWholesaleProximitySearchQuerySafe(query);
    if (!parsed.OK) {
      next(new BadRequestException(parsed.ERROR));
      return;
    }

    const ctx: WholesaleUsGeoContext = {
      countryCode: 'US',
      proximityEnabled: parsed.DATA.proximityEnabled,
      latitude: parsed.DATA.latitude,
      longitude: parsed.DATA.longitude,
      radiusMiles: parsed.DATA.radiusMiles,
      q: parsed.DATA.q,
      limit: parsed.DATA.limit,
    };
    req.wholesaleUsGeo = ctx;

    if (ctx.proximityEnabled) {
      this.logger.log(
        `GEO_FILTER_ENABLED COUNTRY_CODE=US LAT=${ctx.latitude} LNG=${ctx.longitude} RADIUS_MI=${ctx.radiusMiles}`,
      );
    }

    next();
  }
}
