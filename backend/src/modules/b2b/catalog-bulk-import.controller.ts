import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { CatalogBulkImportService } from './catalog-bulk-import.service';

/**
 * POST /api/vendors/catalog/bulk-import
 * Body: { csv: string } — raw CSV text with wholesale catalog columns.
 */
@Controller('api/vendors/catalog')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class CatalogBulkImportController {
  constructor(private readonly imports: CatalogBulkImportService) {}

  @Post('bulk-import')
  @HttpCode(202)
  async bulkImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const vendorId = this.requireVendor(user);
    const csvText = extractCsvText(body);
    if (!csvText) {
      throw new BadRequestException(
        'CATALOG_VALIDATION_ERROR: CSV TEXT REQUIRED',
      );
    }

    const job = this.imports.startImport(vendorId, csvText);
    return {
      STATUS: 'CATALOG_INGRESS_STARTED',
      JOB: job,
    };
  }

  /** Optional poll endpoint for async job status. */
  @Get('bulk-import/:jobId')
  async jobStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    const vendorId = this.requireVendor(user);
    const job = this.imports.getJob(jobId);
    if (!job || job.VENDOR_ID !== vendorId) {
      throw new NotFoundException('CATALOG_ERROR: JOB_NOT_FOUND');
    }
    return {
      STATUS:
        job.STATUS === 'COMPLETED'
          ? 'CSV_IMPORT_PROCESSED_SUCCESSFULLY'
          : `CATALOG_IMPORT_${job.STATUS}`,
      JOB: job,
    };
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
    }
    return user.vendorId;
  }
}

function extractCsvText(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) return body;
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  const csv = row.csv ?? row.csvText ?? row.csv_text;
  if (typeof csv === 'string' && csv.trim()) return csv;
  return null;
}
