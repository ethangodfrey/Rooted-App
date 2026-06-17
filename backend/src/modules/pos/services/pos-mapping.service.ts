import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PosProductMapping } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PosMappingService {
  constructor(private readonly prisma: PrismaService) {}

  listForVendor(vendorId: string): Promise<PosProductMapping[]> {
    return this.prisma.posProductMapping.findMany({
      where: { vendorId },
      orderBy: { providerItemName: 'asc' },
    });
  }

  async upsertProductMapping(
    vendorId: string,
    connectionId: string,
    providerCatalogObjectId: string,
    productId: string | null,
    ignored = false,
  ): Promise<PosProductMapping> {
    const connection = await this.prisma.posConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new NotFoundException('Connection not found.');
    if (connection.vendorId !== vendorId) throw new ForbiddenException('Not your connection.');

    return this.prisma.posProductMapping.upsert({
      where: {
        connectionId_providerCatalogObjectId: { connectionId, providerCatalogObjectId },
      },
      create: {
        connectionId,
        vendorId,
        provider: connection.provider,
        providerCatalogObjectId,
        productId,
        ignored,
        autoMatched: false,
      },
      update: { productId, ignored, autoMatched: false },
    });
  }

  /**
   * Resolves the Rooted product id for a provider catalog object during import.
   * Returns null when no active mapping exists (line still imported, just
   * not attributed to a product). Auto-creates a stub mapping row so the vendor
   * can resolve it later in the UI.
   */
  async resolveProductId(
    vendorId: string,
    connectionId: string,
    provider: PosProductMapping['provider'],
    providerCatalogObjectId: string | undefined,
    providerItemName: string | undefined,
  ): Promise<string | null> {
    if (!providerCatalogObjectId) return null;

    const existing = await this.prisma.posProductMapping.findUnique({
      where: {
        connectionId_providerCatalogObjectId: { connectionId, providerCatalogObjectId },
      },
    });
    if (existing) {
      return existing.ignored ? null : existing.productId;
    }

    // Attempt a best-effort auto-match by exact (case-insensitive) name.
    let autoProductId: string | null = null;
    if (providerItemName) {
      const product = await this.prisma.product.findFirst({
        where: { vendorId, name: { equals: providerItemName, mode: 'insensitive' } },
        select: { id: true },
      });
      autoProductId = product?.id ?? null;
    }

    await this.prisma.posProductMapping.create({
      data: {
        connectionId,
        vendorId,
        provider,
        providerCatalogObjectId,
        providerItemName,
        productId: autoProductId,
        autoMatched: autoProductId != null,
      },
    });
    return autoProductId;
  }
}
