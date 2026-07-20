import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  parseWholesaleCatalogCsv,
  type WholesaleCatalogCsvMappedRow,
} from './catalog-csv.parser';
import { WholesaleProductsService } from './wholesale-products.service';

export type CatalogImportJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export type CatalogImportJobSnapshot = {
  JOB_ID: string;
  VENDOR_ID: string;
  STATUS: CatalogImportJobStatus;
  TOTAL_ROWS: number;
  INSERTED: number;
  UPDATED: number;
  SKIPPED: number;
  ERRORS: Array<{ ROW_NUMBER: number; ERROR: string }>;
  STARTED_AT: string | null;
  COMPLETED_AT: string | null;
};

type InternalJob = CatalogImportJobSnapshot & {
  csvText: string;
};

/**
 * Asynchronous wholesale catalog CSV ingress.
 * Telemetry: CATALOG_INGRESS_STARTED, CSV_IMPORT_PROCESSED_SUCCESSFULLY
 */
@Injectable()
export class CatalogBulkImportService {
  private readonly logger = new Logger(CatalogBulkImportService.name);
  private readonly jobs = new Map<string, InternalJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wholesale: WholesaleProductsService,
  ) {}

  getJob(jobId: string): CatalogImportJobSnapshot | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const { csvText: _csv, ...snapshot } = job;
    return snapshot;
  }

  /**
   * Queue CSV processing and return immediately.
   * Enforces US-only rows via parser; inserts/updates wholesale_products.
   */
  startImport(vendorId: string, csvText: string): CatalogImportJobSnapshot {
    const jobId = randomUUID();
    const job: InternalJob = {
      JOB_ID: jobId,
      VENDOR_ID: vendorId,
      STATUS: 'QUEUED',
      TOTAL_ROWS: 0,
      INSERTED: 0,
      UPDATED: 0,
      SKIPPED: 0,
      ERRORS: [],
      STARTED_AT: null,
      COMPLETED_AT: null,
      csvText,
    };
    this.jobs.set(jobId, job);

    this.logger.log(
      `CATALOG_INGRESS_STARTED JOB=${jobId} VENDOR=${vendorId}`,
    );

    setImmediate(() => {
      void this.processJob(jobId).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const failed = this.jobs.get(jobId);
        if (failed) {
          failed.STATUS = 'FAILED';
          failed.COMPLETED_AT = new Date().toISOString();
          failed.ERRORS.push({
            ROW_NUMBER: 0,
            ERROR: `CSV_IMPORT_FAILED ${message.toUpperCase()}`,
          });
        }
        this.logger.error(
          `CSV_IMPORT_FAILED JOB=${jobId} VENDOR=${vendorId} ERROR=${message}`,
        );
      });
    });

    const { csvText: _csv, ...snapshot } = job;
    return snapshot;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.STATUS = 'RUNNING';
    job.STARTED_AT = new Date().toISOString();

    const parsed = parseWholesaleCatalogCsv(job.csvText);
    job.TOTAL_ROWS = parsed.TOTAL_ROWS;
    job.ERRORS = [...parsed.ERRORS];

    if (!parsed.HEADER_OK) {
      job.STATUS = 'FAILED';
      job.COMPLETED_AT = new Date().toISOString();
      this.logger.error(
        `CSV_IMPORT_FAILED JOB=${jobId} REASON=HEADER_INVALID`,
      );
      return;
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < parsed.VALID_ROWS.length; i++) {
      const row = parsed.VALID_ROWS[i]!;
      try {
        const result = await this.upsertRow(job.VENDOR_ID, row);
        if (result === 'INSERTED') inserted += 1;
        else updated += 1;
      } catch (err) {
        skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        job.ERRORS.push({
          ROW_NUMBER: i + 2,
          ERROR: `CSV_ROW_UPSERT_FAILED ${message.toUpperCase()}`,
        });
      }
    }

    job.INSERTED = inserted;
    job.UPDATED = updated;
    job.SKIPPED = skipped;
    job.STATUS = 'COMPLETED';
    job.COMPLETED_AT = new Date().toISOString();

    this.logger.log(
      `CSV_IMPORT_PROCESSED_SUCCESSFULLY JOB=${jobId} VENDOR=${job.VENDOR_ID} INSERTED=${inserted} UPDATED=${updated} SKIPPED=${skipped} ERRORS=${job.ERRORS.length}`,
    );
  }

  private async upsertRow(
    vendorId: string,
    row: WholesaleCatalogCsvMappedRow,
  ): Promise<'INSERTED' | 'UPDATED'> {
    if (row.countryCode !== 'US') {
      throw new Error('NON_US_COUNTRY');
    }

    if (row.latitude != null && row.longitude != null) {
      await this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          latitude: new Prisma.Decimal(row.latitude),
          longitude: new Prisma.Decimal(row.longitude),
          country: 'USA',
        },
      });
    }

    const result = await this.wholesale.upsertCatalogImportRow(vendorId, {
      name: row.name,
      packagingUnit: row.packagingUnit,
      weightLbs: row.weightLbs,
      moq: row.moq,
      unitPriceCents: row.unitPriceCents,
      availableQuantity: row.availableQuantity,
    });
    return result.ACTION;
  }
}
