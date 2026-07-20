import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  calculateRollingAverageDemand,
  FORECAST_LOOKBACK_DAYS,
  type RollingDemandForecast,
} from './demand-forecast.util';

@Injectable()
export class DemandForecastService implements OnModuleInit {
  private readonly logger = new Logger(DemandForecastService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log('ANALYTICS_DASHBOARD_INITIALIZED');
  }

  /**
   * Analyze historical orders + order_items and compute rolling average demand
   * for high-volume SKUs over the last 30 days.
   */
  async generateVendorForecast(vendorId: string): Promise<{
    vendorId: string;
    lookbackDays: number;
    highVolumeSkus: RollingDemandForecast[];
    forecasts: RollingDemandForecast[];
  }> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - FORECAST_LOOKBACK_DAYS);

    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        order: {
          vendorId,
          createdAt: { gte: since },
        },
      },
      _sum: { quantity: true },
    });

    const productIds = rows
      .map((row) => row.productId)
      .filter((id): id is string => id != null);

    const products =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds }, vendorId },
            select: { id: true, name: true },
          })
        : [];
    const productNameById = new Map(
      products.map((product) => [product.id, product.name]),
    );

    const forecasts = calculateRollingAverageDemand(
      rows
        .filter((row) => row.productId != null)
        .map((row) => ({
          productId: row.productId as string,
          productName: productNameById.get(row.productId as string) ?? null,
          totalQuantity: row._sum.quantity ?? 0,
        })),
    );

    const highVolumeSkus = forecasts.filter((forecast) => forecast.isHighVolume);

    this.logger.log(
      `FORECAST_GENERATED_SUCCESSFULLY VENDOR=${vendorId} LOOKBACK_DAYS=${FORECAST_LOOKBACK_DAYS} SKU_COUNT=${forecasts.length} HIGH_VOLUME=${highVolumeSkus.length}`,
    );

    return {
      vendorId,
      lookbackDays: FORECAST_LOOKBACK_DAYS,
      highVolumeSkus,
      forecasts,
    };
  }
}
