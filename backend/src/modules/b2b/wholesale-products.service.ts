import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WholesaleProductStatus } from '@prisma/client';
import type { WholesaleProductCreateInput } from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WholesaleProductsService {
  private readonly logger = new Logger(WholesaleProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(vendorId: string, input: WholesaleProductCreateInput) {
    const created = await this.prisma.wholesaleProduct.create({
      data: {
        vendorId,
        name: input.name,
        description: input.description ?? null,
        packagingUnit: input.packagingUnit,
        weightLbs: input.weightLbs,
        moq: input.moq,
        unitPriceCents: input.unitPriceCents,
        pricingTiers: input.pricingTiers as Prisma.InputJsonValue,
        freightNotes: input.freightNotes ?? null,
        pickupNotes: input.pickupNotes ?? null,
        status: WholesaleProductStatus.ACTIVE,
      },
    });

    this.logger.log(
      `WHOLESALE_SKU_INDEXED ID=${created.id} VENDOR=${vendorId} UNIT=${created.packagingUnit} MOQ=${created.moq}`,
    );
    return created;
  }

  async listForVendor(vendorId: string) {
    return this.prisma.wholesaleProduct.findMany({
      where: { vendorId, status: WholesaleProductStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Peer discovery catalog — ACTIVE wholesale SKUs for a directory vendor. */
  async listCatalogForVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, businessName: true },
    });
    if (!vendor) return null;
    const products = await this.listForVendor(vendorId);
    return { vendor, products };
  }
}
