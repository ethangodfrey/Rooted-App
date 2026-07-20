import {
  BadRequestException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { isUsCountryCode } from '../search/us-geo.util';

export type LogisticsUsRouteContext = {
  countryCode: 'US';
  usOnlyRoutes: true;
};

export type RequestWithLogisticsUsRoute = Request & {
  logisticsUsRoute?: LogisticsUsRouteContext;
};

/**
 * Route optimization middleware for wholesale shipping options.
 * Restricts logistics responses to carriers operating within the United States.
 */
@Injectable()
export class UsLogisticsRouteMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UsLogisticsRouteMiddleware.name);

  use(req: RequestWithLogisticsUsRoute, _res: Response, next: NextFunction): void {
    const query = (req.query ?? {}) as Record<string, unknown>;
    const countryRaw =
      typeof query.country_code === 'string'
        ? query.country_code
        : typeof query.country === 'string'
          ? query.country
          : null;

    if (countryRaw != null && countryRaw.trim() && !isUsCountryCode(countryRaw)) {
      next(
        new BadRequestException(
          'LOGISTICS_ERROR: US_ONLY_ROUTE COUNTRY_FILTER=NON_US',
        ),
      );
      return;
    }

    req.logisticsUsRoute = {
      countryCode: 'US',
      usOnlyRoutes: true,
    };

    this.logger.log('LOGISTICS_US_ROUTE_FILTER_ENABLED COUNTRY_CODE=US');
    next();
  }
}
