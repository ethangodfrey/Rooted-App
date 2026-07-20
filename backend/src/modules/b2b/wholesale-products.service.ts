import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, WholesaleProductStatus } from '@prisma/client';
import type { WholesaleProductCreateInput } from '@vendorly/env-config';

import { PrismaService } from '../../prisma/prisma.service';
import { WholesaleProductIndexerService } from '../search/wholesale-product-indexer.service';

@Injectable()
export class WholesaleProductsService implements OnModuleInit {
  private readonly logger = new Logger(WholesaleProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexer: WholesaleProductIndexerService,
  ) {}

  onModuleInit(): void {
    this.logger.log('RETAIL_SALE_MODE_ENABLED');
    this.logger.log('PRODUCT_RETAIL_ENDPOINT_ACTIVE');
  }

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
        isRetailEnabled: input.isRetailEnabled ?? false,
        retailPrice:
          input.retailPrice == null
            ? null
            : new Prisma.Decimal(input.retailPrice),
        status: WholesaleProductStatus.ACTIVE,
      },
    });

    this.logger.log(
      `WHOLESALE_SKU_INDEXED ID=${created.id} VENDOR=${vendorId} UNIT=${created.packagingUnit} MOQ=${created.moq} AVAILABLE=${created.availableQuantity} RETAIL=${created.isRetailEnabled ? '1' : '0'}`,
    );
    await this.syncProductToSearchIndex(created);
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
    patch: {
      name?: string;
      moq?: number;
      unitPriceCents?: number;
      isRetailEnabled?: boolean;
      retailPrice?: number | null;
    },
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
        ...(patch.isRetailEnabled !== undefined
          ? { isRetailEnabled: patch.isRetailEnabled }
          : {}),
        ...(patch.retailPrice !== undefined
          ? {
              retailPrice:
                patch.retailPrice == null
                  ? null
                  : new Prisma.Decimal(patch.retailPrice),
            }
          : {}),
      },
    });

    if (updated.isRetailEnabled) {
      this.logger.log(
        `RETAIL_SALE_MODE_ENABLED SKU=${updated.id} RETAIL_PRICE=${updated.retailPrice?.toString() ?? 'NULL'}`,
      );
    }

    await this.syncProductToSearchIndex(updated);
    return updated;
  }

  /** Load vendor geo and push to ES (US-only validation inside indexer). */
  private async syncProductToSearchIndex(product: {
    id: string;
    vendorId: string;
    name: string;
    description: string | null;
    packagingUnit: string;
    moq: number;
    unitPriceCents: number;
    availableQuantity: number;
    status: string;
    updatedAt: Date;
  }): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: product.vendorId },
      select: { latitude: true, longitude: true, country: true },
    });

    const latitude =
      vendor?.latitude == null ? null : Number(vendor.latitude);
    const longitude =
      vendor?.longitude == null ? null : Number(vendor.longitude);

    await this.indexer.indexProduct({
      id: product.id,
      vendorId: product.vendorId,
      name: product.name,
      description: product.description,
      packagingUnit: product.packagingUnit,
      moq: product.moq,
      unitPriceCents: product.unitPriceCents,
      availableQuantity: product.availableQuantity,
      status: product.status,
      updatedAt: product.updatedAt.toISOString(),
      country: vendor?.country ?? 'USA',
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    });
  }
}
