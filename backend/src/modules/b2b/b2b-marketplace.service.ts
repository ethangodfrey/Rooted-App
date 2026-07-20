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
  formatProcurementDashboardInitializedLog,
  formatProcurementRequestedLog,
  formatProcurementStatusUpdatedLog,
  formatWholesaleDirectoryActiveLog,
  formatWholesaleUiActiveLog,
  inferItemCategory,
  normalizeAvailabilityStatus,
  normalizeProcurementStatus,
  type ProcurementRequestStatus,
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

export type DirectoryFilters = {
  limit?: number;
  q?: string | null;
  location?: string | null;
  category?: string | null;
};

@Injectable()
export class B2bMarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(B2bMarketplaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatB2bMarketplaceInitializedLog());
    this.logger.log(formatProcurementDashboardInitializedLog());
  }

  async listDirectory(filters: DirectoryFilters = {}) {
    const safeLimit = Math.min(
      100,
      Math.max(1, Math.floor(filters.limit ?? 40)),
    );
    const q = (filters.q ?? '').trim().toLowerCase();
    const location = (filters.location ?? '').trim().toLowerCase();
    const category = (filters.category ?? '').trim().toUpperCase();

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
          sell_city: string | null;
          sell_state: string | null;
          postal_code: string | null;
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
          COALESCE(f.farm_name, v.business_name) AS producer_name,
          COALESCE(f.sell_city, v.sell_city) AS sell_city,
          COALESCE(f.sell_state, v.sell_state) AS sell_state,
          COALESCE(f.postal_code, v.postal_code) AS postal_code
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

      let items = rows.map((row) => {
        const itemCategory = inferItemCategory(row.item_name);
        const locationLabel = [row.sell_city, row.sell_state, row.postal_code]
          .map((p) => (p ?? '').trim())
          .filter(Boolean)
          .join(', ');
        return {
          id: row.id,
          producerId: row.producer_id,
          producerType: row.producer_type,
          producerName: row.producer_name,
          itemName: row.item_name,
          itemCategory,
          bulkUnitPrice: Number(row.bulk_unit_price),
          minOrderQuantity: Number(row.min_order_quantity),
          availabilityStatus: row.availability_status,
          sellCity: row.sell_city,
          sellState: row.sell_state,
          postalCode: row.postal_code,
          locationLabel: locationLabel || null,
        };
      });

      if (q) {
        items = items.filter((item) => {
          const hay = [
            item.itemName,
            item.producerName,
            item.itemCategory,
            item.locationLabel,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });
      }
      if (location) {
        items = items.filter((item) =>
          (item.locationLabel ?? '').toLowerCase().includes(location),
        );
      }
      if (category && category !== 'ALL') {
        items = items.filter((item) => item.itemCategory === category);
      }

      this.logger.log(
        formatWholesaleDirectoryActiveLog({ count: items.length }),
      );
      this.logger.log(formatWholesaleUiActiveLog({ count: items.length }));

      return {
        STATUS: 'WHOLESALE_UI_ACTIVE',
        ITEMS: items,
        COUNT: items.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `WHOLESALE_UI_ACTIVE DEGRADED ERROR=${message}`,
      );
      return { STATUS: 'WHOLESALE_UI_ACTIVE', ITEMS: [], COUNT: 0 };
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
          updated_at: Date;
          farm_name: string | null;
          item_name: string | null;
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
          r.updated_at,
          f.farm_name,
          l.item_name
        FROM public.b2b_procurement_requests r
        JOIN public.farmers f ON f.id = r.farmer_id
        LEFT JOIN public.wholesale_listings l ON l.id = r.listing_id
        WHERE r.vendor_id = ${vendorId}::uuid
        ORDER BY r.created_at DESC
        LIMIT 50
      `);
      this.logger.log(formatProcurementDashboardInitializedLog());
      return {
        STATUS: 'PROCUREMENT_DASHBOARD_INITIALIZED',
        ITEMS: rows.map((row) => ({
          id: row.id,
          farmerId: row.farmer_id,
          farmName: row.farm_name,
          listingId: row.listing_id,
          itemName: row.item_name,
          message: row.message,
          requestedQuantity:
            row.requested_quantity != null
              ? Number(row.requested_quantity)
              : null,
          status: normalizeProcurementStatus(row.status) ?? row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        COUNT: rows.length,
      };
    } catch {
      return {
        STATUS: 'PROCUREMENT_DASHBOARD_INITIALIZED',
        ITEMS: [],
        COUNT: 0,
      };
    }
  }

  async listProcurementForFarmer(farmerId: string) {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          vendor_id: string;
          listing_id: string | null;
          message: string | null;
          requested_quantity: number | string | null;
          status: string;
          created_at: Date;
          business_name: string | null;
          item_name: string | null;
        }>
      >(Prisma.sql`
        SELECT
          r.id,
          r.vendor_id,
          r.listing_id,
          r.message,
          r.requested_quantity,
          r.status,
          r.created_at,
          v.business_name,
          l.item_name
        FROM public.b2b_procurement_requests r
        JOIN public.vendors v ON v.id = r.vendor_id
        LEFT JOIN public.wholesale_listings l ON l.id = r.listing_id
        WHERE r.farmer_id = ${farmerId}::uuid
        ORDER BY r.created_at DESC
        LIMIT 50
      `);
      return {
        STATUS: 'PROCUREMENT_DASHBOARD_INITIALIZED',
        ITEMS: rows.map((row) => ({
          id: row.id,
          vendorId: row.vendor_id,
          vendorName: row.business_name,
          listingId: row.listing_id,
          itemName: row.item_name,
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
      return {
        STATUS: 'PROCUREMENT_DASHBOARD_INITIALIZED',
        ITEMS: [],
        COUNT: 0,
      };
    }
  }

  /**
   * Farmer (or admin) accepts/declines a procurement request.
   * Vendor may CANCELLED their own pending request.
   * Notifies the vendor when a farmer updates status.
   */
  async updateProcurementStatus(input: {
    requestId: string;
    statusRaw: string;
    actor: { role: string; vendorId?: string | null; farmerId?: string | null };
  }) {
    const status = normalizeProcurementStatus(input.statusRaw);
    if (!status || status === 'PENDING') {
      throw new BadRequestException('PROCUREMENT_STATUS_INVALID');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        farmer_id: string;
        status: string;
      }>
    >(Prisma.sql`
      SELECT id, vendor_id, farmer_id, status
      FROM public.b2b_procurement_requests
      WHERE id = ${input.requestId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('PROCUREMENT_REQUEST_NOT_FOUND');

    const current = rows[0];
    const isFarmer =
      input.actor.farmerId != null && input.actor.farmerId === current.farmer_id;
    const isVendor =
      input.actor.vendorId != null && input.actor.vendorId === current.vendor_id;
    const isAdmin = input.actor.role === 'admin';

    if (status === 'CANCELLED') {
      if (!isVendor && !isAdmin) {
        throw new BadRequestException('VENDOR_CANCEL_ONLY');
      }
    } else if (status === 'ACCEPTED' || status === 'DECLINED') {
      if (!isFarmer && !isAdmin) {
        throw new BadRequestException('FARMER_STATUS_ONLY');
      }
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.b2b_procurement_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${input.requestId}::uuid
    `);

    this.logger.log(
      formatProcurementStatusUpdatedLog({
        requestId: input.requestId,
        status,
      }),
    );

    // Notify vendor when farmer (or admin acting as farmer path) updates status.
    if (
      (status === 'ACCEPTED' || status === 'DECLINED') &&
      (isFarmer || isAdmin)
    ) {
      await this.notifyVendorOfProcurementUpdate({
        vendorId: current.vendor_id,
        requestId: input.requestId,
        status,
      });
    }

    return {
      STATUS: 'PROCUREMENT_DASHBOARD_INITIALIZED',
      REQUEST_ID: input.requestId,
      REQUEST_STATUS: status,
    };
  }

  private async notifyVendorOfProcurementUpdate(input: {
    vendorId: string;
    requestId: string;
    status: ProcurementRequestStatus;
  }): Promise<void> {
    try {
      const vendors = await this.prisma.$queryRaw<
        Array<{ user_id: string }>
      >(Prisma.sql`
        SELECT user_id FROM public.vendors
        WHERE id = ${input.vendorId}::uuid
        LIMIT 1
      `);
      const userId = vendors[0]?.user_id;
      if (!userId) return;

      const title = 'PROCUREMENT REQUEST UPDATED';
      const body = `Your bulk connection request is now ${input.status}.`;

      try {
        await this.prisma.$executeRaw(Prisma.sql`
          SELECT public.enqueue_notification(
            ${userId}::uuid,
            ${title},
            ${body},
            'CONNECTION_REQUEST'::public.notification_type
          )
        `);
      } catch {
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO public.notification_logs (
            user_id, title, body, notification_type
          ) VALUES (
            ${userId}::uuid,
            ${title},
            ${body},
            'CONNECTION_REQUEST'::public.notification_type
          )
        `);
      }
      this.logger.log(
        `PROCUREMENT_DASHBOARD_INITIALIZED ACTION=VENDOR_NOTIFIED REQUEST=${input.requestId} STATUS=${input.status}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PROCUREMENT_DASHBOARD_INITIALIZED NOTIFY_SKIPPED ERROR=${message}`,
      );
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
