import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { LogisticsService } from './logistics.service';
import type { RequestWithLogisticsUsRoute } from './us-logistics-route.middleware';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/orders/:orderId/shipping-options
 * Returns cost-optimized US freight routes for a wholesale order.
 */
@Controller('api/orders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class LogisticsShippingController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get(':orderId/shipping-options')
  async getShippingOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Req() req: Request & RequestWithLogisticsUsRoute,
  ) {
    const vendorId = this.requireVendor(user);
    const normalizedOrderId = orderId.trim();
    if (!UUID_RE.test(normalizedOrderId)) {
      throw new BadRequestException(
        'LOGISTICS_VALIDATION_ERROR: ORDER_ID INVALID',
      );
    }

    const result = await this.logistics.calculateShippingRoutesForOrder(
      normalizedOrderId,
      vendorId,
    );

    const usOnly = req.logisticsUsRoute?.usOnlyRoutes === true;
    const routes = usOnly
      ? result.routes.filter((route) => route.countryCode === 'US')
      : result.routes;

    return {
      STATUS: 'LOGISTICS_SHIPPING_OPTIONS',
      COUNTRY_CODE: 'US',
      US_ONLY_ROUTES: usOnly,
      SESSION_VENDOR_ID: vendorId,
      ORDER_ID: result.orderId,
      DISTANCE_MILES: Number(result.distanceMiles.toFixed(2)),
      WEIGHT_LBS: Number(result.weightLbs.toFixed(2)),
      ROUTE_COUNT: routes.length,
      ROUTES: routes.map((route) => ({
        RANK: route.rank,
        CARRIER_CODE: route.carrierCode,
        CARRIER_NAME: route.carrierName,
        SERVICE_LEVEL: route.serviceLevel,
        COUNTRY_CODE: route.countryCode,
        DISTANCE_MILES: Number(route.distanceMiles.toFixed(2)),
        WEIGHT_LBS: Number(route.weightLbs.toFixed(2)),
        FREIGHT_CENTS: route.freightCents,
        ESTIMATED_TRANSIT_DAYS: route.estimatedTransitDays,
        ORIGIN: {
          VENDOR_ID: route.origin.vendorId,
          BUSINESS_NAME: route.origin.businessName,
          LATITUDE: route.origin.latitude,
          LONGITUDE: route.origin.longitude,
          COUNTRY_CODE: route.origin.countryCode,
        },
        DESTINATION: {
          VENDOR_ID: route.destination.vendorId,
          BUSINESS_NAME: route.destination.businessName,
          LATITUDE: route.destination.latitude,
          LONGITUDE: route.destination.longitude,
          COUNTRY_CODE: route.destination.countryCode,
        },
      })),
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}
