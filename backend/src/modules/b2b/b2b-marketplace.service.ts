import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  assertMinOrderQuantity,
  assertPositiveMoney,
  formatB2bMarketplaceInitializedLog,
  formatProcurementRequestedLog,
  formatWholesaleDirectoryActiveLog,
  normalizeAvailabilityStatus,
  normalizeProcurementStatus,
} from './b2b-marketplace.util';

export type CreateProcurementBody = {
  farmerId?: string;
  listingId?: string | null;
  message?: string | null;
  requestedQuantity?: number | null;
};

export type CreateListingBody = {
  itemName?: string;
  bulkUnitPrice?: number;
  minOrderQuantity?: number;
  availabilityStatus?: string;
  producerType?: 'FARMER' | 'VENDOR';
};

@Injectable()
export class B2bMarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(B2bMarketplaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatB2bMarketplaceInitializedLog());
  }

  async listDirectory(limit = 40) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          producer_id: string;
          producer_type: string;
          item_name: string;
          bulk_unit_price: number | string;
          min_order_quantity: number | string;
          availability_status: string;
          producer_name: string | null;
        }>
      >(Prisma.sql`
        SELECT
          l.id,
          l.producer_id,
          l.producer_type::text AS producer_type,
          l.item_name,
          l.bulk_unit_price,
          l.min_order_quantity,
          l.availability_status::text AS availability_status,
          COALESCE(f.farm_name, v.business_name) AS producer_name
        FROM public.wholesale_listings l
        LEFT JOIN public.farmers f
          ON l.producer_type = 'FARMER'::public.wholesale_producer_type
         AND f.id = l.producer_id
         AND f.is_wholesale_supplier = true
        LEFT JOIN public.vendors v
          ON l.producer_type = 'VENDOR'::public.wholesale_producer_type
         AND v.id = l.producer_id
         AND v.is_wholesale_provider = true
        WHERE l.availability_status <> 'UNAVAILABLE'::public.wholesale_listing_availability
          AND (
            (l.producer_type = 'FARMER'::public.wholesale_producer_type AND f.id IS NOT NULL)
            OR (l.producer_type = 'VENDOR'::public.wholesale_producer_type AND v.id IS NOT NULL)
          )
        ORDER BY l.created_at DESC
        LIMIT ${safeLimit}
      `);

      this.logger.log(
        formatWholesaleDirectoryActiveLog({ count: rows.length }),
      );

      return {
        STATUS: 'WHOLESALE_DIRECTORY_ACTIVE',
        ITEMS: rows.map((row) => ({
          id: row.id,
          producerId: row.producer_id,
          producerType: row.producer_type,
          producerName: row.producer_name,
          itemName: row.item_name,
          bulkUnitPrice: Number(row.bulk_unit_price),
          minOrderQuantity: Number(row.min_order_quantity),
          availabilityStatus: row.availability_status,
        })),
        COUNT: rows.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `WHOLESALE_DIRECTORY_ACTIVE DEGRADED ERROR=${message}`,
      );
      return { STATUS: 'WHOLESALE_DIRECTORY_ACTIVE', ITEMS: [], COUNT: 0 };
    }
  }

  async createListing(
    producerId: string,
    producerType: 'FARMER' | 'VENDOR',
    body: CreateListingBody,
  ) {
    const itemName = (body.itemName ?? '').trim();
    if (!itemName) throw new BadRequestException('ITEM_NAME_REQUIRED');
    const price = Number(body.bulkUnitPrice);
    const moq = Math.floor(Number(body.minOrderQuantity ?? 1));
    try {
      assertPositiveMoney(price, 'BULK_UNIT_PRICE');
      assertMinOrderQuantity(moq);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'LISTING_INVALID',
      );
    }
    const availability = normalizeAvailabilityStatus(body.availabilityStatus);

    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO public.wholesale_listings (
          producer_id, producer_type, item_name,
          bulk_unit_price, min_order_quantity, availability_status
        ) VALUES (
          ${producerId}::uuid,
          ${producerType}::public.wholesale_producer_type,
          ${itemName},
          ${price},
          ${moq},
          ${availability}::public.wholesale_listing_availability
        )
        RETURNING id
      `);
      this.logger.log(
        `B2B_MARKETPLACE_INITIALIZED ACTION=LISTING_CREATED ID=${rows[0]?.id} PRODUCER=${producerId}`,
      );
      return {
        STATUS: 'B2B_MARKETPLACE_INITIALIZED',
        LISTING_ID: rows[0]?.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`LISTING_CREATE_FAILED:${message}`);
    }
  }

  async resolveFarmerIdForUser(userId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM public.farmers WHERE user_id = ${userId}::uuid LIMIT 1
    `);
    if (!rows[0]?.id) throw new NotFoundException('FARMER_NOT_FOUND');
    return rows[0].id;
  }

  async createProcurement(vendorId: string, body: CreateProcurementBody) {
    const farmerId = body.farmerId?.trim();
    if (!farmerId) throw new BadRequestException('FARMER_ID_REQUIRED');

    const farmer = await this.prisma.$queryRaw<
      Array<{ id: string; is_wholesale_supplier: boolean }>
    >(Prisma.sql`
      SELECT id, is_wholesale_supplier
      FROM public.farmers
      WHERE id = ${farmerId}::uuid
      LIMIT 1
    `);
    if (!farmer[0]) throw new NotFoundException('FARMER_NOT_FOUND');
    if (!farmer[0].is_wholesale_supplier) {
      throw new BadRequestException('FARMER_NOT_WHOLESALE_SUPPLIER');
    }

    let listingId = body.listingId?.trim() || null;
    if (listingId) {
      const listing = await this.prisma.$queryRaw<
        Array<{ id: string; producer_id: string }>
      >(Prisma.sql`
        SELECT id, producer_id
        FROM public.wholesale_listings
        WHERE id = ${listingId}::uuid
        LIMIT 1
      `);
      if (!listing[0]) throw new NotFoundException('LISTING_NOT_FOUND');
      if (listing[0].producer_id !== farmerId) {
        throw new BadRequestException('LISTING_FARMER_MISMATCH');
      }
    }

    const qty =
      body.requestedQuantity != null
        ? Math.floor(Number(body.requestedQuantity))
        : null;
    if (qty != null && (Number.isNaN(qty) || qty < 1)) {
      throw new BadRequestException('REQUESTED_QUANTITY_INVALID');
    }

    const message = body.message?.trim() || null;

    try {
      // Prefer upsert when listing_id is present; null listing_id uses manual dedupe.
      if (listingId) {
        const rows = await this.prisma.$queryRaw<
          Array<{ id: string; status: string }>
        >(Prisma.sql`
          INSERT INTO public.b2b_procurement_requests (
            vendor_id, farmer_id, listing_id, message, requested_quantity, status
          ) VALUES (
            ${vendorId}::uuid,
            ${farmerId}::uuid,
            ${listingId}::uuid,
            ${message},
            ${qty},
            'PENDING'
          )
          ON CONFLICT (vendor_id, farmer_id, listing_id)
          DO UPDATE SET
            message = COALESCE(EXCLUDED.message, public.b2b_procurement_requests.message),
            requested_quantity = COALESCE(
              EXCLUDED.requested_quantity,
              public.b2b_procurement_requests.requested_quantity
            ),
            status = 'PENDING',
            updated_at = NOW()
          RETURNING id, status
        `);
        this.logger.log(
          formatProcurementRequestedLog({ vendorId, farmerId, listingId }),
        );
        return {
          STATUS: 'B2B_MARKETPLACE_INITIALIZED',
          ACTION: 'PROCUREMENT_REQUESTED',
          REQUEST_ID: rows[0]?.id,
          REQUEST_STATUS: rows[0]?.status ?? 'PENDING',
        };
      }

      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM public.b2b_procurement_requests
        WHERE vendor_id = ${vendorId}::uuid
          AND farmer_id = ${farmerId}::uuid
          AND listing_id IS NULL
          AND status = 'PENDING'
        LIMIT 1
      `);
      if (existing[0]?.id) {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE public.b2b_procurement_requests
          SET
            message = COALESCE(${message}, message),
            requested_quantity = COALESCE(${qty}, requested_quantity),
            updated_at = NOW()
          WHERE id = ${existing[0].id}::uuid
        `);
        this.logger.log(
          formatProcurementRequestedLog({ vendorId, farmerId, listingId }),
        );
        return {
          STATUS: 'B2B_MARKETPLACE_INITIALIZED',
          ACTION: 'PROCUREMENT_REQUESTED',
          REQUEST_ID: existing[0].id,
          REQUEST_STATUS: 'PENDING',
        };
      }

      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; status: string }>
      >(Prisma.sql`
        INSERT INTO public.b2b_procurement_requests (
          vendor_id, farmer_id, listing_id, message, requested_quantity, status
        ) VALUES (
          ${vendorId}::uuid,
          ${farmerId}::uuid,
          NULL,
          ${message},
          ${qty},
          'PENDING'
        )
        RETURNING id, status
      `);

      this.logger.log(
        formatProcurementRequestedLog({
          vendorId,
          farmerId,
          listingId,
        }),
      );

      return {
        STATUS: 'B2B_MARKETPLACE_INITIALIZED',
        ACTION: 'PROCUREMENT_REQUESTED',
        REQUEST_ID: rows[0]?.id,
        REQUEST_STATUS: rows[0]?.status ?? 'PENDING',
      };
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      if (messageText.toLowerCase().includes('unique')) {
        throw new BadRequestException('PROCUREMENT_REQUEST_EXISTS');
      }
      throw new BadRequestException(`PROCUREMENT_FAILED:${messageText}`);
    }
  }

  async listProcurementForVendor(vendorId: string) {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          farmer_id: string;
          listing_id: string | null;
          message: string | null;
          requested_quantity: number | string | null;
          status: string;
          created_at: Date;
          farm_name: string | null;
        }>
      >(Prisma.sql`
        SELECT
          r.id,
          r.farmer_id,
          r.listing_id,
          r.message,
          r.requested_quantity,
          r.status,
          r.created_at,
          f.farm_name
        FROM public.b2b_procurement_requests r
        JOIN public.farmers f ON f.id = r.farmer_id
        WHERE r.vendor_id = ${vendorId}::uuid
        ORDER BY r.created_at DESC
        LIMIT 50
      `);
      return {
        STATUS: 'B2B_MARKETPLACE_INITIALIZED',
        ITEMS: rows.map((row) => ({
          id: row.id,
          farmerId: row.farmer_id,
          farmName: row.farm_name,
          listingId: row.listing_id,
          message: row.message,
          requestedQuantity:
            row.requested_quantity != null
              ? Number(row.requested_quantity)
              : null,
          status: normalizeProcurementStatus(row.status) ?? row.status,
          createdAt: row.created_at,
        })),
        COUNT: rows.length,
      };
    } catch {
      return { STATUS: 'B2B_MARKETPLACE_INITIALIZED', ITEMS: [], COUNT: 0 };
    }
  }

  async setWholesaleFlags(input: {
    vendorId?: string | null;
    farmerId?: string | null;
    enabled: boolean;
  }) {
    if (input.vendorId) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.vendors
        SET is_wholesale_provider = ${input.enabled}, updated_at = NOW()
        WHERE id = ${input.vendorId}::uuid
      `);
    }
    if (input.farmerId) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.farmers
        SET is_wholesale_supplier = ${input.enabled}, updated_at = NOW()
        WHERE id = ${input.farmerId}::uuid
      `);
    }
    this.logger.log(
      `WHOLESALE_DIRECTORY_ACTIVE ACTION=FLAG_UPDATE ENABLED=${input.enabled ? '1' : '0'}`,
    );
    return { STATUS: 'WHOLESALE_DIRECTORY_ACTIVE', ENABLED: input.enabled };
  }
}
