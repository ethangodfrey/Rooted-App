import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  Prisma,
  WholesaleProductStatus,
  WholesaleSaleModePreference,
} from '@prisma/client';
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

  private resolveSalePreference(input: {
    saleModePreference?: WholesaleSaleModePreference | null;
    isRetailEnabled?: boolean | null;
  }): WholesaleSaleModePreference {
    if (input.saleModePreference) return input.saleModePreference;
    if (input.isRetailEnabled) return WholesaleSaleModePreference.BOTH;
    return WholesaleSaleModePreference.WHOLESALE_ONLY;
  }

  private requiresRetailPrice(mode: WholesaleSaleModePreference): boolean {
    return (
      mode === WholesaleSaleModePreference.RETAIL_ONLY ||
      mode === WholesaleSaleModePreference.BOTH
    );
  }

  async create(vendorId: string, input: WholesaleProductCreateInput) {
    const saleModePreference = this.resolveSalePreference({
      saleModePreference: (input as { saleModePreference?: WholesaleSaleModePreference })
        .saleModePreference,
      isRetailEnabled: input.isRetailEnabled,
    });
    const isRetailEnabled = this.requiresRetailPrice(saleModePreference);
    if (
      isRetailEnabled &&
      (input.retailPrice == null || Number(input.retailPrice) <= 0)
    ) {
      throw new ForbiddenException(
        'WHOLESALE_VALIDATION_ERROR: RETAIL_PRICE REQUIRED FOR RETAIL_OR_BOTH_MODE',
      );
    }

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
        isRetailEnabled,
        saleModePreference,
        retailPrice:
          input.retailPrice == null
            ? null
            : new Prisma.Decimal(input.retailPrice),
        status: WholesaleProductStatus.ACTIVE,
      },
    });

    this.logger.log(
      `WHOLESALE_SKU_INDEXED ID=${created.id} VENDOR=${vendorId} UNIT=${created.packagingUnit} MOQ=${created.moq} AVAILABLE=${created.availableQuantity} RETAIL=${created.isRetailEnabled ? '1' : '0'} SALE_MODE=${created.saleModePreference}`,
    );
    this.logger.log(
      `VENDOR_SALE_PREFERENCE_SYNCED SKU=${created.id} SALE_MODE=${created.saleModePreference}`,
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
      saleModePreference?: WholesaleSaleModePreference;
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

    const current = await this.prisma.wholesaleProduct.findUnique({
      where: { id: productId },
      select: {
        saleModePreference: true,
        isRetailEnabled: true,
        retailPrice: true,
      },
    });
    if (!current) {
      throw new NotFoundException('WHOLESALE_ERROR: PRODUCT_NOT_FOUND');
    }
    const resolvedSaleMode = this.resolveSalePreference({
      saleModePreference:
        patch.saleModePreference ?? current.saleModePreference,
      isRetailEnabled:
        patch.isRetailEnabled ?? current.isRetailEnabled,
    });
    const resolvedRetailEnabled = this.requiresRetailPrice(resolvedSaleMode);
    const resolvedRetailPrice =
      patch.retailPrice !== undefined ? patch.retailPrice : Number(current.retailPrice);
    if (
      resolvedRetailEnabled &&
      (resolvedRetailPrice == null || Number(resolvedRetailPrice) <= 0)
    ) {
      throw new ForbiddenException(
        'WHOLESALE_VALIDATION_ERROR: RETAIL_PRICE REQUIRED FOR RETAIL_OR_BOTH_MODE',
      );
    }

    const updated = await this.prisma.wholesaleProduct.update({
      where: { id: productId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.moq !== undefined ? { moq: patch.moq } : {}),
        ...(patch.unitPriceCents !== undefined
          ? { unitPriceCents: patch.unitPriceCents }
          : {}),
        isRetailEnabled: resolvedRetailEnabled,
        saleModePreference: resolvedSaleMode,
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
    this.logger.log(
      `CATALOG_MODE_UPDATED SKU=${updated.id} SALE_MODE=${updated.saleModePreference}`,
    );
    this.logger.log(
      `VENDOR_SALE_PREFERENCE_SYNCED SKU=${updated.id} SALE_MODE=${updated.saleModePreference}`,
    );

    await this.syncProductToSearchIndex(updated);
    return updated;
  }

  /**
   * Catalog CSV ingress upsert — match ACTIVE SKU by name, else create.
   * Caller must already enforce US country_code.
   */
  async upsertCatalogImportRow(
    vendorId: string,
    input: {
      name: string;
      packagingUnit: string;
      weightLbs: number;
      moq: number;
      unitPriceCents: number;
      availableQuantity: number;
    },
  ): Promise<{ ACTION: 'INSERTED' | 'UPDATED'; PRODUCT_ID: string }> {
    const existing = await this.prisma.wholesaleProduct.findFirst({
      where: {
        vendorId,
        name: input.name,
        status: WholesaleProductStatus.ACTIVE,
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      const updated = await this.prisma.wholesaleProduct.update({
        where: { id: existing.id },
        data: {
          moq: input.moq,
          unitPriceCents: input.unitPriceCents,
          availableQuantity: input.availableQuantity,
          packagingUnit: input.packagingUnit,
          weightLbs: new Prisma.Decimal(input.weightLbs),
        },
      });
      await this.syncProductToSearchIndex(updated);
      return { ACTION: 'UPDATED', PRODUCT_ID: updated.id };
    }

    const created = await this.create(vendorId, {
      name: input.name,
      packagingUnit: input.packagingUnit,
      weightLbs: input.weightLbs,
      moq: input.moq,
      unitPriceCents: input.unitPriceCents,
      pricingTiers: [],
      availableQuantity: input.availableQuantity,
      isRetailEnabled: false,
      retailPrice: null,
    });
    return { ACTION: 'INSERTED', PRODUCT_ID: created.id };
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
