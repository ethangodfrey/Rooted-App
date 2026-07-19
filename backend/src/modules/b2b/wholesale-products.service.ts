import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WholesaleProductStatus } from '@prisma/client';
import type { WholesaleProductCreateInput } from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';
import { WholesaleProductIndexerService } from '../search/wholesale-product-indexer.service';

@Injectable()
export class WholesaleProductsService {
  private readonly logger = new Logger(WholesaleProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexer: WholesaleProductIndexerService,
  ) {}

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
        availableQuantity: input.availableQuantity ?? 0,
        status: WholesaleProductStatus.ACTIVE,
      },
    });

    this.logger.log(
      `WHOLESALE_SKU_INDEXED ID=${created.id} VENDOR=${vendorId} UNIT=${created.packagingUnit} MOQ=${created.moq} AVAILABLE=${created.availableQuantity}`,
    );
    await this.indexer.indexProduct({
      id: created.id,
      vendorId: created.vendorId,
      name: created.name,
      description: created.description,
      packagingUnit: created.packagingUnit,
      moq: created.moq,
      unitPriceCents: created.unitPriceCents,
      availableQuantity: created.availableQuantity,
      status: created.status,
      updatedAt: created.updatedAt.toISOString(),
    });
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

  /**
   * Ownership-gated mutation — Tenant_B cannot append/update Tenant_A SKUs.
   * Mirrors wholesale_products RLS: vendor_id must match auth vendor.
   */
  async updateForVendor(
    sessionVendorId: string,
    productId: string,
    patch: { name?: string; moq?: number; unitPriceCents?: number },
  ) {
    const existing = await this.prisma.wholesaleProduct.findUnique({
      where: { id: productId },
      select: { id: true, vendorId: true },
    });

    if (!existing) {
      throw new NotFoundException('WHOLESALE_ERROR: PRODUCT_NOT_FOUND');
    }

    if (existing.vendorId !== sessionVendorId) {
      this.logger.warn(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=WHOLESALE_UPDATE SESSION=${sessionVendorId} OWNER=${existing.vendorId} PRODUCT=${productId}`,
      );
      throw new ForbiddenException('B2B_ERROR: CROSS_TENANT_FORBIDDEN');
    }

    const updated = await this.prisma.wholesaleProduct.update({
      where: { id: productId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.moq !== undefined ? { moq: patch.moq } : {}),
        ...(patch.unitPriceCents !== undefined
          ? { unitPriceCents: patch.unitPriceCents }
          : {}),
      },
    });

    await this.indexer.indexProduct({
      id: updated.id,
      vendorId: updated.vendorId,
      name: updated.name,
      description: updated.description,
      packagingUnit: updated.packagingUnit,
      moq: updated.moq,
      unitPriceCents: updated.unitPriceCents,
      availableQuantity: updated.availableQuantity,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });

    return updated;
  }
}
