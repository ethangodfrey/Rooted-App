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

  constructor(private readonly prisma: PrismaService) {}

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

  async createInquiry(shopperId: string, body: CreateInquiryBody) {
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

    const eventDate = body.eventDate?.trim()
      ? new Date(body.eventDate)
      : null;

    const row = await this.prisma.cateringInquiry.create({
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
    });

    this.logger.log(
      `VENDOR_SERVICES_UPDATED ACTION=INQUIRY VENDOR=${body.vendorId} SHOPPER=${shopperId} INQUIRY=${row.id}`,
    );

    return {
      STATUS: 'VENDOR_SERVICES_UPDATED',
      INQUIRY_ID: row.id,
    };
  }

  /** Raw fallback when Prisma client is ahead of DB (used by verify scripts conceptually). */
  async ensureTablesExistProbe(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1 FROM public.vendor_catering_services LIMIT 0`);
      return true;
    } catch {
      return false;
    }
  }
}
