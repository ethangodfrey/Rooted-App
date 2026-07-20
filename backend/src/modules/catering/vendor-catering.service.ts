import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import {
  assertCateringGuestRange,
  formatCateringModuleInitializedLog,
  formatVendorServicesUpdatedLog,
  normalizeCateringDescription,
} from './vendor-catering.util';

export type UpsertCateringBody = {
  isCateringProvider: boolean;
  serviceDescription?: string;
  minGuests?: number;
  maxGuests?: number;
  priceRangeEstimate?: string | null;
};

export type CreateInquiryBody = {
  vendorId: string;
  message: string;
  guestCount?: number | null;
  eventDate?: string | null;
};

@Injectable()
export class VendorCateringService implements OnModuleInit {
  private readonly logger = new Logger(VendorCateringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatCateringModuleInitializedLog());
  }

  async getForVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        businessName: true,
        isCateringProvider: true,
        cateringService: true,
      },
    });
    if (!vendor) throw new NotFoundException('VENDOR_NOT_FOUND');
    return {
      STATUS: 'CATERING_MODULE_INITIALIZED',
      VENDOR_ID: vendor.id,
      BUSINESS_NAME: vendor.businessName,
      IS_CATERING_PROVIDER: vendor.isCateringProvider,
      SERVICE: vendor.cateringService
        ? {
            serviceDescription: vendor.cateringService.serviceDescription,
            minGuests: vendor.cateringService.minGuests,
            maxGuests: vendor.cateringService.maxGuests,
            priceRangeEstimate: vendor.cateringService.priceRangeEstimate,
          }
        : null,
    };
  }

  async upsertForVendor(vendorId: string, body: UpsertCateringBody) {
    const enabled = Boolean(body.isCateringProvider);
    const minGuests = Math.max(1, Math.floor(body.minGuests ?? 1));
    const maxGuests = Math.max(1, Math.floor(body.maxGuests ?? 50));
    assertCateringGuestRange(minGuests, maxGuests);
    const description = normalizeCateringDescription(body.serviceDescription);
    const price = (body.priceRangeEstimate ?? '').trim() || null;

    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { isCateringProvider: enabled },
    });

    if (enabled) {
      await this.prisma.vendorCateringService.upsert({
        where: { vendorId },
        create: {
          vendorId,
          serviceDescription: description,
          minGuests,
          maxGuests,
          priceRangeEstimate: price,
        },
        update: {
          serviceDescription: description,
          minGuests,
          maxGuests,
          priceRangeEstimate: price,
        },
      });
    }

    this.logger.log(
      formatVendorServicesUpdatedLog({
        vendorId,
        enabled,
        minGuests,
        maxGuests,
      }),
    );

    return this.getForVendor(vendorId);
  }

  async listCateringProviders(limit = 40) {
    const rows = await this.prisma.vendor.findMany({
      where: { isCateringProvider: true },
      take: Math.min(100, Math.max(1, limit)),
      orderBy: { businessName: 'asc' },
      select: {
        id: true,
        businessName: true,
        isCateringProvider: true,
        cateringService: true,
      },
    });

    return {
      STATUS: 'VENDOR_SERVICES_UPDATED',
      COUNT: rows.length,
      ITEMS: rows.map((row) => ({
        vendorId: row.id,
        businessName: row.businessName,
        isCateringProvider: row.isCateringProvider,
        serviceDescription: row.cateringService?.serviceDescription ?? null,
        minGuests: row.cateringService?.minGuests ?? null,
        maxGuests: row.cateringService?.maxGuests ?? null,
        priceRangeEstimate: row.cateringService?.priceRangeEstimate ?? null,
      })),
    };
  }

  async createInquiry(shopperUserId: string, body: CreateInquiryBody) {
    const message = (body.message ?? '').trim();
    if (!body.vendorId?.trim()) {
      throw new BadRequestException('VENDOR_ID_REQUIRED');
    }
    if (!message) {
      throw new BadRequestException('MESSAGE_REQUIRED');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: body.vendorId },
      select: { id: true, isCateringProvider: true },
    });
    if (!vendor) throw new NotFoundException('VENDOR_NOT_FOUND');
    if (!vendor.isCateringProvider) {
      throw new BadRequestException('VENDOR_NOT_CATERING_PROVIDER');
    }

    const shopperId = await this.resolveShopperId(shopperUserId);

    const eventDateRaw = body.eventDate?.trim() || null;
    const eventDate =
      eventDateRaw && Number.isFinite(new Date(eventDateRaw).getTime())
        ? new Date(eventDateRaw)
        : null;

    let status = 'OPEN';
    let conflictDetected = false;
    let conflictWarning: string | null = null;

    if (eventDateRaw) {
      const check = await this.availability.checkAvailability(
        body.vendorId,
        eventDateRaw,
      );
      if (check.BLOCKED) {
        status = 'PENDING_REVIEW';
        conflictDetected = true;
        conflictWarning = check.CONFLICT_WARNING ?? 'Conflict Detected';
        this.logger.log(
          `AVAILABILITY_SYNC_ACTIVE ACTION=CONFLICT_DETECTED VENDOR=${body.vendorId} DATE=${check.DATE}`,
        );
      }
    }

    let row: { id: string };
    try {
      row = await this.prisma.cateringInquiry.create({
        data: {
          vendorId: body.vendorId,
          shopperId,
          message,
          guestCount: body.guestCount ?? null,
          eventDate:
            eventDate && Number.isFinite(eventDate.getTime())
              ? eventDate
              : null,
          status,
          conflictDetected,
          conflictWarning,
        },
        select: { id: true },
      });
    } catch {
      // phase77 columns / PENDING_REVIEW may not exist yet.
      row = await this.prisma.cateringInquiry.create({
        data: {
          vendorId: body.vendorId,
          shopperId,
          message,
          guestCount: body.guestCount ?? null,
          eventDate:
            eventDate && Number.isFinite(eventDate.getTime())
              ? eventDate
              : null,
          status: 'OPEN',
        },
        select: { id: true },
      });
      if (conflictDetected) {
        try {
          await this.prisma.$executeRaw(Prisma.sql`
            UPDATE public.catering_inquiries
            SET
              status = 'PENDING_REVIEW',
              conflict_detected = true,
              conflict_warning = ${conflictWarning},
              updated_at = NOW()
            WHERE id = ${row.id}::uuid
          `);
        } catch {
          // keep OPEN if schema not migrated
        }
      }
    }

    try {
      await this.prisma.$executeRaw(Prisma.sql`
        SELECT public.bump_engagement_metric(
          ${body.vendorId}::uuid,
          'VENDOR'::public.engagement_entity_type,
          'INQUIRY'::public.engagement_metric_type,
          1,
          (timezone('utc', now()))::date
        )
      `);
    } catch {
      // phase73 may not be applied yet
    }

    this.logger.log(
      `VENDOR_SERVICES_UPDATED ACTION=INQUIRY VENDOR=${body.vendorId} SHOPPER=${shopperId} INQUIRY=${row.id} STATUS=${status}`,
    );

    return {
      STATUS: 'VENDOR_SERVICES_UPDATED',
      INQUIRY_ID: row.id,
      INQUIRY_STATUS: status,
      CONFLICT_DETECTED: conflictDetected,
      CONFLICT_WARNING: conflictWarning,
    };
  }

  async listInquiriesForVendor(vendorId: string) {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          message: string;
          guest_count: number | null;
          event_date: Date | string | null;
          status: string;
          conflict_detected: boolean | null;
          conflict_warning: string | null;
          created_at: Date;
        }>
      >(Prisma.sql`
        SELECT
          id, message, guest_count, event_date, status,
          conflict_detected, conflict_warning, created_at
        FROM public.catering_inquiries
        WHERE vendor_id = ${vendorId}::uuid
        ORDER BY
          CASE WHEN status = 'PENDING_REVIEW' THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 50
      `);

      return {
        STATUS: 'AVAILABILITY_SYNC_ACTIVE',
        ITEMS: rows.map((row) => ({
          id: row.id,
          message: row.message,
          guestCount: row.guest_count,
          eventDate:
            row.event_date != null
              ? String(row.event_date).slice(0, 10)
              : null,
          status: row.status,
          conflictDetected: Boolean(row.conflict_detected),
          conflictWarning: row.conflict_warning,
          createdAt: row.created_at,
        })),
        COUNT: rows.length,
      };
    } catch {
      const rows = await this.prisma.cateringInquiry.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          message: true,
          guestCount: true,
          eventDate: true,
          status: true,
          createdAt: true,
        },
      });
      return {
        STATUS: 'AVAILABILITY_SYNC_ACTIVE',
        ITEMS: rows.map((row) => ({
          id: row.id,
          message: row.message,
          guestCount: row.guestCount,
          eventDate: row.eventDate
            ? row.eventDate.toISOString().slice(0, 10)
            : null,
          status: row.status,
          conflictDetected: row.status === 'PENDING_REVIEW',
          conflictWarning:
            row.status === 'PENDING_REVIEW' ? 'Conflict Detected' : null,
          createdAt: row.createdAt,
        })),
        COUNT: rows.length,
      };
    }
  }

  private async resolveShopperId(userId: string): Promise<string> {
    const shopper = await this.prisma.shopper.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (shopper?.id) return shopper.id;

    try {
      const created = await this.prisma.shopper.create({
        data: { userId },
        select: { id: true },
      });
      return created.id;
    } catch {
      throw new BadRequestException('SHOPPER_REQUIRED');
    }
  }

  async ensureTablesExistProbe(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw(
        Prisma.sql`SELECT 1 FROM public.vendor_catering_services LIMIT 0`,
      );
      return true;
    } catch {
      return false;
    }
  }
}
