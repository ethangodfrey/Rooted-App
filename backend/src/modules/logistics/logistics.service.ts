import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  haversineDistanceMiles,
  isUsCountryCode,
} from '../search/us-geo.util';
import {
  RegionalFreightCarrierClient,
  type RegionalFreightEstimate,
} from './regional-freight-carrier.client';

export type LogisticsVendorLocation = {
  vendorId: string;
  businessName: string | null;
  latitude: number;
  longitude: number;
  countryCode: string;
};

export type LogisticsRouteOption = {
  rank: number;
  carrierCode: string;
  carrierName: string;
  serviceLevel: string;
  countryCode: 'US';
  distanceMiles: number;
  weightLbs: number;
  freightCents: number;
  estimatedTransitDays: number;
  origin: LogisticsVendorLocation;
  destination: LogisticsVendorLocation;
};

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  const num =
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
      ? value.toNumber()
      : Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolveVendorLocation(vendor: {
  id: string;
  businessName: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  country: string | null;
}): LogisticsVendorLocation {
  const latitude = decimalToNumber(vendor.latitude);
  const longitude = decimalToNumber(vendor.longitude);
  if (latitude == null || longitude == null) {
    throw new BadRequestException(
      `LOGISTICS_ERROR: VENDOR_COORDINATES_REQUIRED VENDOR=${vendor.id}`,
    );
  }
  if (!isUsCountryCode(vendor.country)) {
    throw new BadRequestException(
      `LOGISTICS_ERROR: US_ONLY_ROUTE VENDOR=${vendor.id}`,
    );
  }

  return {
    vendorId: vendor.id,
    businessName: vendor.businessName,
    latitude,
    longitude,
    countryCode: 'US',
  };
}

function toRouteOption(
  estimate: RegionalFreightEstimate,
  rank: number,
  origin: LogisticsVendorLocation,
  destination: LogisticsVendorLocation,
): LogisticsRouteOption {
  return {
    rank,
    carrierCode: estimate.carrierCode,
    carrierName: estimate.carrierName,
    serviceLevel: estimate.serviceLevel,
    countryCode: estimate.countryCode,
    distanceMiles: estimate.distanceMiles,
    weightLbs: estimate.weightLbs,
    freightCents: estimate.freightCents,
    estimatedTransitDays: estimate.estimatedTransitDays,
    origin,
    destination,
  };
}

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly carrierClient: RegionalFreightCarrierClient,
  ) {}

  /**
   * Calculates optimized freight routes for a wholesale order using vendor geo pins.
   * Routes are restricted to carriers operating within the United States.
   */
  async calculateShippingRoutesForOrder(
    orderId: string,
    sessionVendorId: string,
  ): Promise<{
    orderId: string;
    distanceMiles: number;
    weightLbs: number;
    routes: LogisticsRouteOption[];
  }> {
    const order = await this.prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      include: {
        buyerVendor: {
          select: {
            id: true,
            businessName: true,
            latitude: true,
            longitude: true,
            country: true,
          },
        },
        sellerVendor: {
          select: {
            id: true,
            businessName: true,
            latitude: true,
            longitude: true,
            country: true,
          },
        },
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                weightLbs: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('LOGISTICS_ERROR: ORDER_NOT_FOUND');
    }

    if (
      order.buyerVendorId !== sessionVendorId &&
      order.sellerVendorId !== sessionVendorId
    ) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=SHIPPING_OPTIONS SESSION=${sessionVendorId} ORDER=${orderId}`,
      );
      throw new ForbiddenException('B2B_ERROR: ORDER_ACCESS_DENIED');
    }

    const origin = resolveVendorLocation(order.sellerVendor);
    const destination = resolveVendorLocation(order.buyerVendor);

    const distanceMiles = haversineDistanceMiles(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );

    const weightLbs = order.items.reduce((total, item) => {
      const unitWeight = decimalToNumber(item.product.weightLbs) ?? 1;
      return total + item.quantity * unitWeight;
    }, 0);

    const estimates = await this.carrierClient.fetchShippingEstimates({
      distanceMiles,
      weightLbs: Math.max(1, weightLbs),
      originCountry: order.sellerVendor.country,
      destinationCountry: order.buyerVendor.country,
    });

    const routes = estimates.map((estimate, index) =>
      toRouteOption(estimate, index + 1, origin, destination),
    );

    this.logger.log(
      `LOGISTICS_ROUTE_CALCULATED ORDER=${orderId} DISTANCE_MI=${distanceMiles.toFixed(1)} WEIGHT_LBS=${Math.max(1, weightLbs).toFixed(1)} ROUTES=${routes.length}`,
    );

    return {
      orderId,
      distanceMiles,
      weightLbs: Math.max(1, weightLbs),
      routes,
    };
  }
}
