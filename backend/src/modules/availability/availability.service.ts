import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  conflictWarningForReasons,
  formatAvailabilitySyncActiveLog,
  formatSchedulingEngineInitializedLog,
  normalizeBlockReason,
  toDateOnlyString,
  type AvailabilityBlockReason,
  type AvailabilityStatus,
} from './availability.util';

export type AvailabilityCheckResult = {
  STATUS: AvailabilityStatus;
  VENDOR_ID: string;
  DATE: string;
  BLOCKED: boolean;
  REASONS: AvailabilityBlockReason[];
  CONFLICT_WARNING: string | null;
};

@Injectable()
export class AvailabilityService implements OnModuleInit {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log(formatSchedulingEngineInitializedLog());
  }

  /**
   * Returns AVAILABLE | BLOCKED for a vendor on a calendar date.
   */
  async checkAvailability(
    vendorId: string,
    date: string | Date,
  ): Promise<AvailabilityCheckResult> {
    const dateOnly = toDateOnlyString(date);
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!dateOnly) throw new BadRequestException('DATE_INVALID');

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ reason: string }>
      >(Prisma.sql`
        SELECT reason
        FROM public.vendor_availability
        WHERE vendor_id = ${vendorId}::uuid
          AND blocked_date = ${dateOnly}::date
        ORDER BY reason ASC
      `);

      const reasons = rows
        .map((r) => normalizeBlockReason(r.reason))
        .filter((r): r is AvailabilityBlockReason => r != null);

      const blocked = reasons.length > 0;
      this.logger.log(
        formatAvailabilitySyncActiveLog({
          vendorId,
          count: reasons.length,
        }),
      );

      return {
        STATUS: blocked ? 'BLOCKED' : 'AVAILABLE',
        VENDOR_ID: vendorId,
        DATE: dateOnly,
        BLOCKED: blocked,
        REASONS: reasons,
        CONFLICT_WARNING: blocked
          ? conflictWarningForReasons(reasons)
          : null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `AVAILABILITY_SYNC_ACTIVE DEGRADED ERROR=${message}`,
      );
      // Fail open so inquiries still work if phase75 not applied.
      return {
        STATUS: 'AVAILABLE',
        VENDOR_ID: vendorId,
        DATE: dateOnly,
        BLOCKED: false,
        REASONS: [],
        CONFLICT_WARNING: null,
      };
    }
  }

  async listBlocks(vendorId: string, from?: string | null, to?: string | null) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    const fromDate = from ? toDateOnlyString(from) : null;
    const toDate = to ? toDateOnlyString(to) : null;

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          blocked_date: Date | string;
          reason: string;
        }>
      >(
        fromDate && toDate
          ? Prisma.sql`
              SELECT id, blocked_date, reason
              FROM public.vendor_availability
              WHERE vendor_id = ${vendorId}::uuid
                AND blocked_date >= ${fromDate}::date
                AND blocked_date <= ${toDate}::date
              ORDER BY blocked_date ASC, reason ASC
            `
          : Prisma.sql`
              SELECT id, blocked_date, reason
              FROM public.vendor_availability
              WHERE vendor_id = ${vendorId}::uuid
              ORDER BY blocked_date ASC, reason ASC
              LIMIT 366
            `,
      );

      this.logger.log(
        formatAvailabilitySyncActiveLog({ vendorId, count: rows.length }),
      );

      return {
        STATUS: 'AVAILABILITY_SYNC_ACTIVE',
        VENDOR_ID: vendorId,
        ITEMS: rows.map((row) => ({
          id: row.id,
          blockedDate: String(row.blocked_date).slice(0, 10),
          reason: normalizeBlockReason(row.reason) ?? row.reason,
        })),
        COUNT: rows.length,
      };
    } catch {
      return {
        STATUS: 'AVAILABILITY_SYNC_ACTIVE',
        VENDOR_ID: vendorId,
        ITEMS: [],
        COUNT: 0,
      };
    }
  }

  async setBlock(input: {
    vendorId: string;
    date: string;
    reason: string;
    blocked: boolean;
  }) {
    const dateOnly = toDateOnlyString(input.date);
    const reason = normalizeBlockReason(input.reason);
    if (!dateOnly) throw new BadRequestException('DATE_INVALID');
    if (!reason) throw new BadRequestException('REASON_INVALID');

    if (input.blocked) {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.vendor_availability (vendor_id, blocked_date, reason)
        VALUES (${input.vendorId}::uuid, ${dateOnly}::date, ${reason})
        ON CONFLICT (vendor_id, blocked_date, reason) DO UPDATE
          SET updated_at = NOW()
      `);
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM public.vendor_availability
        WHERE vendor_id = ${input.vendorId}::uuid
          AND blocked_date = ${dateOnly}::date
          AND reason = ${reason}
      `);
    }

    this.logger.log(
      formatAvailabilitySyncActiveLog({
        vendorId: input.vendorId,
        count: input.blocked ? 1 : 0,
      }),
    );

    return this.checkAvailability(input.vendorId, dateOnly);
  }
}
