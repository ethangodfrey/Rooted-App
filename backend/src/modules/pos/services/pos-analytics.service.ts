import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { POS_INVENTORY_TX_TYPE } from '../pos.constants';

/**
 * Bridges imported POS sales into Rooted analytics:
 *  1. Writes inventory_transactions rows (type `sale_pos`) for mapped line items
 *     so the existing live vendor analytics + CSV export include card sales.
 *     Idempotent: each line item links to at most one inventory transaction.
 *  2. Recomputes analytics_snapshots POS contribution per affected date.
 */
@Injectable()
export class PosAnalyticsService {
  private readonly logger = new Logger(PosAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures inventory_transactions exist for every mapped line item of a POS
   * transaction. Returns the YYYY-MM-DD date of the sale (for aggregation).
   */
  async syncInventoryForTransaction(importedTransactionId: string): Promise<string | null> {
    const txn = await this.prisma.posImportedTransaction.findUnique({
      where: { id: importedTransactionId },
      include: { lineItems: true },
    });
    if (!txn || txn.state !== 'COMPLETED') return null;

    const source = `pos:${txn.provider.toLowerCase()}:${txn.providerTransactionId}`;

    for (const line of txn.lineItems) {
      if (!line.productId || line.inventoryTransactionId) continue;

      await this.prisma.$transaction(async (tx) => {
        const inventoryTx = await tx.inventoryTransaction.create({
          data: {
            vendorId: txn.vendorId,
            productId: line.productId!,
            eventId: txn.eventId,
            transactionType: POS_INVENTORY_TX_TYPE,
            quantityChange: -Math.abs(line.quantity),
            source,
            notes: `POS sale (${line.name}) — gross ${line.grossAmount}c`,
          },
        });
        await tx.posImportedLineItem.update({
          where: { id: line.id },
          data: { inventoryTransactionId: inventoryTx.id },
        });
      });
    }

    return txn.soldAt.toISOString().slice(0, 10);
  }

  /**
   * Recomputes the POS contribution to analytics_snapshots for the given vendor
   * and dates. Fully derived from pos_imported_transactions, so re-running is
   * idempotent (no double counting).
   */
  async recomputeSnapshots(vendorId: string, dates: string[]): Promise<void> {
    for (const date of dates) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);

      const txns = await this.prisma.posImportedTransaction.findMany({
        where: {
          vendorId,
          state: 'COMPLETED',
          soldAt: { gte: dayStart, lte: dayEnd },
        },
        include: { lineItems: { select: { quantity: true } } },
      });

      const revenueTotal = txns.reduce((sum, t) => sum + t.netAmount, 0);
      const units = txns.reduce(
        (sum, t) => sum + t.lineItems.reduce((s, li) => s + li.quantity, 0),
        0,
      );

      await this.prisma.analyticsSnapshot.upsert({
        where: { vendorId_date: { vendorId, date: dayStart } },
        create: {
          vendorId,
          date: dayStart,
          revenueTotal,
          inpersonSales: units,
          ordersTotal: txns.length,
        },
        // NOTE: POS-owned recompute. If app-order rollups also write this row,
        // merge both sources here rather than overwrite.
        update: {
          revenueTotal,
          inpersonSales: units,
          ordersTotal: txns.length,
        },
      });
    }
    this.logger.debug(`Recomputed ${dates.length} snapshot day(s) for vendor ${vendorId}`);
  }
}
