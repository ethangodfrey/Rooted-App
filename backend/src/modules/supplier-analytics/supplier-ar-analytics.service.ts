import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  aggregateSupplierArSummary,
  type SupplierArSummary,
} from './supplier-ar-analytics.util';

@Injectable()
export class SupplierArAnalyticsService {
  private readonly logger = new Logger(SupplierArAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getArSummaryForSeller(
    sessionVendorId: string,
    sellerVendorId: string,
  ): Promise<SupplierArSummary> {
    if (sessionVendorId !== sellerVendorId) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=AR_SUMMARY SESSION=${sessionVendorId} TARGET=${sellerVendorId}`,
      );
      throw new ForbiddenException('B2B_ERROR: VENDOR_ACCESS_DENIED');
    }

    const rows = await this.prisma.wholesaleInvoice.findMany({
      where: { sellerVendorId },
      select: {
        status: true,
        totalCents: true,
        issuedAt: true,
        paidAt: true,
      },
    });

    const summary = aggregateSupplierArSummary(
      rows.map((row) => ({
        status: row.status,
        totalCents: row.totalCents,
        issuedAt: row.issuedAt,
        paidAt: row.paidAt,
      })),
    );

    this.logger.log(
      `METRICS_AGGREGATION_SUCCESS SELLER=${sellerVendorId} COLLECTED_CENTS=${summary.COLLECTED_REVENUE_CENTS} PENDING_CENTS=${summary.PENDING_REVENUE_CENTS} AVG_DAYS_TO_PAY=${summary.AVERAGE_DAYS_TO_PAY}`,
    );

    return summary;
  }
}
