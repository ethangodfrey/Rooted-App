import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type PosConnection } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { resolvePosLineItemName } from '../utils/pos-line-item.util';
import type { NormalizedTransaction } from '../types/normalized-transaction';
import { PosAnalyticsService } from './pos-analytics.service';
import { PosMappingService } from './pos-mapping.service';

export interface ImportResult {
  imported: number;
  skipped: number;
  updated: number;
  affectedDates: string[];
}

@Injectable()
export class PosImportService {
  private readonly logger = new Logger(PosImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapping: PosMappingService,
    private readonly analytics: PosAnalyticsService,
  ) {}

  /**
   * Idempotently persists a batch of normalized transactions for a connection.
   * Duplicate protection: unique (connectionId, providerTransactionId). Existing
   * rows are skipped (or state-updated for refunds/voids) rather than duplicated.
   */
  async importTransactions(
    connection: PosConnection,
    syncRunId: string,
    transactions: NormalizedTransaction[],
  ): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, skipped: 0, updated: 0, affectedDates: [] };
    const affected = new Set<string>();

    // Resolve the event context from a location mapping once per batch.
    const eventId = await this.resolveEventId(connection);

    for (const txn of transactions) {
      try {
        const existing = await this.prisma.posImportedTransaction.findUnique({
          where: {
            connectionId_providerTransactionId: {
              connectionId: connection.id,
              providerTransactionId: txn.providerTransactionId,
            },
          },
          include: { lineItems: true },
        });

        if (existing) {
          let touched = false;
          if (existing.state !== txn.state) {
            await this.prisma.posImportedTransaction.update({
              where: { id: existing.id },
              data: { state: txn.state, syncRunId },
            });
            touched = true;
          }
          if (existing.lineItems.length === 0 && txn.lineItems.length > 0) {
            await this.backfillLineItems(existing.id, connection, syncRunId, txn);
            await this.analytics.syncInventoryForTransaction(existing.id);
            touched = true;
          } else if (existing.lineItems.length > 0) {
            touched = (await this.refreshLineItemNames(existing, txn)) || touched;
          }
          if (touched) {
            result.updated += 1;
            affected.add(txn.soldAt.slice(0, 10));
          } else {
            result.skipped += 1;
          }
          continue;
        }

        const created = await this.createTransaction(connection, syncRunId, txn, eventId);
        result.imported += 1;
        affected.add(txn.soldAt.slice(0, 10));

        // Bridge into inventory + analytics (idempotent).
        await this.analytics.syncInventoryForTransaction(created.id);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Lost a race with a concurrent import — safe to treat as skipped.
          result.skipped += 1;
          continue;
        }
        await this.recordImportError(connection.id, syncRunId, txn, err);
      }
    }

    result.affectedDates = [...affected];
    return result;
  }

  private async buildLineItemData(
    connection: PosConnection,
    txn: NormalizedTransaction,
  ): Promise<Prisma.PosImportedLineItemCreateWithoutTransactionInput[]> {
    const lineItemData: Prisma.PosImportedLineItemCreateWithoutTransactionInput[] = [];
    for (const li of txn.lineItems) {
      const productId = await this.mapping.resolveProductId(
        connection.vendorId,
        connection.id,
        connection.provider,
        li.providerCatalogObjectId,
        li.name,
      );
      lineItemData.push({
        providerLineItemId: li.providerLineItemId,
        providerCatalogObjectId: li.providerCatalogObjectId,
        name: li.name,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        grossAmount: li.grossAmount,
        discountAmount: li.discountAmount ?? 0,
        taxAmount: li.taxAmount ?? 0,
        product: productId ? { connect: { id: productId } } : undefined,
        rawPayload: (li.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      });
    }
    return lineItemData;
  }

  private async refreshLineItemNames(
    existing: {
      id: string;
      lineItems: Array<{ id: string; name: string; grossAmount: number; rawPayload: unknown }>;
    },
    txn: NormalizedTransaction,
  ): Promise<boolean> {
    let updated = false;
    for (const dbLine of existing.lineItems) {
      const uid =
        dbLine.rawPayload && typeof dbLine.rawPayload === 'object'
          ? (dbLine.rawPayload as { uid?: string }).uid
          : undefined;
      const source = uid
        ? txn.lineItems.find((li) => li.providerLineItemId === uid)
        : undefined;
      const nextName = resolvePosLineItemName(
        source?.name ?? dbLine.name,
        dbLine.grossAmount,
        source?.raw ?? dbLine.rawPayload,
      );
      if (nextName !== dbLine.name) {
        await this.prisma.posImportedLineItem.update({
          where: { id: dbLine.id },
          data: { name: nextName },
        });
        updated = true;
      }
    }
    return updated;
  }

  private async backfillLineItems(
    transactionId: string,
    connection: PosConnection,
    syncRunId: string,
    txn: NormalizedTransaction,
  ) {
    const lineItemData = await this.buildLineItemData(connection, txn);
    if (lineItemData.length === 0) return;
    await this.prisma.posImportedTransaction.update({
      where: { id: transactionId },
      data: {
        syncRunId,
        rawPayload: txn.raw as Prisma.InputJsonValue,
        lineItems: { create: lineItemData },
      },
    });
  }

  private async createTransaction(
    connection: PosConnection,
    syncRunId: string,
    txn: NormalizedTransaction,
    eventId: string | null,
  ) {
    const lineItemData = await this.buildLineItemData(connection, txn);

    return this.prisma.posImportedTransaction.create({
      data: {
        connectionId: connection.id,
        vendorId: connection.vendorId,
        syncRunId,
        provider: connection.provider,
        providerTransactionId: txn.providerTransactionId,
        providerOrderId: txn.providerOrderId,
        providerLocationId: txn.providerLocationId,
        state: txn.state,
        soldAt: new Date(txn.soldAt),
        currency: txn.currency,
        grossAmount: txn.grossAmount,
        discountAmount: txn.discountAmount,
        taxAmount: txn.taxAmount,
        tipAmount: txn.tipAmount,
        netAmount: txn.netAmount,
        tenderType: txn.tenderType,
        cardBrand: txn.cardBrand,
        eventId,
        rawPayload: txn.raw as Prisma.InputJsonValue,
        lineItems: { create: lineItemData },
      },
    });
  }

  private async resolveEventId(connection: PosConnection): Promise<string | null> {
    if (!connection.providerLocationId) return null;
    const mapping = await this.prisma.posLocationMapping.findUnique({
      where: {
        connectionId_providerLocationId: {
          connectionId: connection.id,
          providerLocationId: connection.providerLocationId,
        },
      },
      select: { eventId: true },
    });
    return mapping?.eventId ?? null;
  }

  private async recordImportError(
    connectionId: string,
    syncRunId: string,
    txn: NormalizedTransaction,
    err: unknown,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : 'Unknown import error';
    this.logger.error(`Import failed for ${txn.providerTransactionId}: ${message}`);
    await this.prisma.posSyncError.create({
      data: {
        connectionId,
        syncRunId,
        scope: 'IMPORT',
        message: message.slice(0, 1000),
        providerReference: txn.providerTransactionId,
        payload: { soldAt: txn.soldAt } as Prisma.InputJsonValue,
        retryable: true,
      },
    });
  }
}
