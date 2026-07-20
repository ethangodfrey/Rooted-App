import { Injectable, Logger } from '@nestjs/common';
import { VendorAlertType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DemandForecastService } from './demand-forecast.service';

const ALERT_DEDUPE_HOURS = 24;

@Injectable()
export class VendorAlertsService {
  private readonly logger = new Logger(VendorAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: DemandForecastService,
  ) {}

  async createAlert(input: {
    vendorId: string;
    alertType: VendorAlertType;
    message: string;
  }) {
    const alert = await this.prisma.vendorAlert.create({
      data: {
        vendorId: input.vendorId,
        alertType: input.alertType,
        message: input.message,
      },
    });
    this.logger.log(
      `VENDOR_ALERT_CREATED VENDOR=${input.vendorId} TYPE=${input.alertType} ID=${alert.id}`,
    );
    return alert;
  }

  /**
   * Compare on-hand inventory to 30-day forecast threshold for high-volume SKUs.
   */
  async sweepLowStockForVendor(vendorId: string): Promise<number> {
    const forecast = await this.forecast.generateVendorForecast(vendorId);
    if (forecast.highVolumeSkus.length === 0) return 0;

    const productIds = forecast.highVolumeSkus.map((sku) => sku.productId);
    const stockRows = await this.prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        vendorId,
        productId: { in: productIds },
      },
      _sum: { quantityChange: true },
    });
    const stockByProductId = new Map(
      stockRows.map((row) => [row.productId, row._sum.quantityChange ?? 0]),
    );

    const dedupeSince = new Date();
    dedupeSince.setUTCHours(dedupeSince.getUTCHours() - ALERT_DEDUPE_HOURS);

    let created = 0;
    for (const sku of forecast.highVolumeSkus) {
      const currentStock = stockByProductId.get(sku.productId) ?? 0;
      if (currentStock >= sku.forecast30DayThreshold) continue;

      const marker = `PRODUCT_ID=${sku.productId}`;
      const existing = await this.prisma.vendorAlert.findFirst({
        where: {
          vendorId,
          alertType: VendorAlertType.LOW_STOCK,
          message: { contains: marker },
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });
      if (existing) continue;

      const label = sku.productName ?? sku.productId;
      await this.createAlert({
        vendorId,
        alertType: VendorAlertType.LOW_STOCK,
        message: `LOW_STOCK ${marker} NAME=${label} STOCK=${currentStock} FORECAST_30D=${Math.ceil(sku.forecast30DayThreshold)}`,
      });
      this.logger.log(
        `VENDOR_LOW_STOCK_ALERT_TRIGGERED VENDOR=${vendorId} ${marker} STOCK=${currentStock} FORECAST_30D=${Math.ceil(sku.forecast30DayThreshold)}`,
      );
      created += 1;
    }

    return created;
  }

  async sweepLowStockForAllVendors(): Promise<{ vendors: number; alerts: number }> {
    const vendors = await this.prisma.product.findMany({
      distinct: ['vendorId'],
      select: { vendorId: true },
    });

    let alerts = 0;
    for (const vendor of vendors) {
      alerts += await this.sweepLowStockForVendor(vendor.vendorId);
    }

    this.logger.log(
      `LOW_STOCK_SWEEP_COMPLETED VENDORS=${vendors.length} ALERTS=${alerts}`,
    );
    return { vendors: vendors.length, alerts };
  }
}
