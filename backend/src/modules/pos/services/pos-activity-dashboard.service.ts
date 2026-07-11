import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  LOW_STOCK_THRESHOLD,
  POS_ACTIVITY_WINDOW_HOURS,
  type PosActivityDashboardResponse,
  type PosActivityFeedItem,
  type PosLowStockAlert,
} from '../dto/pos-activity-dashboard.dto';

function parseProviderFromSource(source: string | null): string | null {
  if (!source) return null;
  if (source.startsWith('pos-inventory:')) {
    return source.split(':')[1]?.toLowerCase() ?? null;
  }
  if (source.startsWith('pos:')) {
    return source.split(':')[1]?.toLowerCase() ?? null;
  }
  return null;
}

function formatProviderLabel(provider: string | null): string {
  if (!provider) return 'POS';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

@Injectable()
export class PosActivityDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates the last 24 hours of POS sync + inventory activity for one vendor.
   * Designed for dashboard polling — single round-trip with parallel queries.
   */
  async getDashboard(vendorId: string): Promise<PosActivityDashboardResponse> {
    const since = new Date(Date.now() - POS_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);

    const [
      activePosTerminals,
      transactionSyncRuns,
      inventorySyncEvents,
      syncLatencyRows,
      inventoryRows,
      syncRunRows,
      lowStockRows,
    ] = await Promise.all([
      this.prisma.posConnection.count({
        where: { vendorId, status: 'ACTIVE' },
      }),
      this.prisma.posSyncRun.count({
        where: {
          connection: { vendorId },
          finishedAt: { gte: since },
          status: { in: ['SUCCESS', 'PARTIAL'] },
        },
      }),
      this.prisma.inventoryTransaction.count({
        where: {
          vendorId,
          transactionType: 'pos_inventory_sync',
          createdAt: { gte: since },
        },
      }),
      this.prisma.posSyncRun.findMany({
        where: {
          connection: { vendorId },
          finishedAt: { gte: since },
          startedAt: { not: null },
          status: { in: ['SUCCESS', 'PARTIAL'] },
        },
        select: { startedAt: true, finishedAt: true },
        take: 200,
        orderBy: { finishedAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          vendorId,
          createdAt: { gte: since },
          transactionType: { in: ['pos_inventory_sync', 'sale_pos'] },
        },
        include: {
          product: { select: { id: true, name: true } },
          event: { select: { id: true, name: true, city: true, state: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      this.prisma.posSyncRun.findMany({
        where: {
          connection: { vendorId },
          finishedAt: { gte: since },
          status: { in: ['SUCCESS', 'PARTIAL', 'FAILED'] },
        },
        include: {
          connection: { select: { provider: true, displayName: true } },
        },
        orderBy: { finishedAt: 'desc' },
        take: 20,
      }),
      this.queryLowStockAlerts(vendorId, since),
    ]);

    const latencySamples = syncLatencyRows
      .filter((row) => row.startedAt && row.finishedAt)
      .map((row) => row.finishedAt!.getTime() - row.startedAt!.getTime());
    const queueLatencyMs =
      latencySamples.length > 0
        ? Math.round(latencySamples.reduce((sum, ms) => sum + ms, 0) / latencySamples.length)
        : null;

    const feed = this.buildFeed(inventoryRows, syncRunRows);

    return {
      metrics: {
        windowHours: POS_ACTIVITY_WINDOW_HOURS,
        totalSyncsProcessed: transactionSyncRuns + inventorySyncEvents,
        inventorySyncEvents,
        transactionSyncRuns,
        activePosTerminals,
        lowStockAlertCount: lowStockRows.length,
        queueLatencyMs,
        queueLatencySampleSize: latencySamples.length,
        lastUpdatedAt: new Date().toISOString(),
      },
      lowStockAlerts: lowStockRows,
      feed,
    };
  }

  private buildFeed(
    inventoryRows: Array<{
      id: string;
      transactionType: string;
      quantityChange: number;
      source: string | null;
      notes: string | null;
      createdAt: Date;
      product: { id: string; name: string };
      event: { id: string; name: string; city: string | null; state: string | null } | null;
    }>,
    syncRunRows: Array<{
      id: string;
      status: string;
      transactionsImported: number;
      finishedAt: Date | null;
      connection: { provider: string; displayName: string | null };
    }>,
  ): PosActivityFeedItem[] {
    const inventoryFeed: PosActivityFeedItem[] = inventoryRows.map((row) => {
      const provider = parseProviderFromSource(row.source);
      const providerLabel = formatProviderLabel(provider);
      const eventLabel = row.event
        ? `${row.event.name}${row.event.city ? ` · ${row.event.city}` : ''}${row.event.state ? `, ${row.event.state}` : ''}`
        : null;

      if (row.transactionType === 'pos_inventory_sync') {
        const absoluteMatch = row.notes?.match(/set to (\d+)/i);
        const stockLevel = absoluteMatch ? Number(absoluteMatch[1]) : null;
        const delta = row.quantityChange !== 0 ? row.quantityChange : null;
        const stockText =
          stockLevel != null
            ? `stock updated to ${stockLevel}`
            : delta != null
              ? `stock ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)}`
              : 'stock updated';

        return {
          id: row.id,
          kind: 'inventory_adjustment',
          message: `${row.product.name} ${stockText} via ${providerLabel}${eventLabel ? ` at ${eventLabel}` : ''}`,
          productName: row.product.name,
          eventName: row.event?.name ?? null,
          provider: providerLabel,
          quantity: stockLevel ?? delta,
          stockLevel,
          occurredAt: row.createdAt.toISOString(),
        };
      }

      return {
        id: row.id,
        kind: 'pos_sale',
        message: `${row.product.name} sold (${Math.abs(row.quantityChange)} units) via ${providerLabel}${eventLabel ? ` at ${eventLabel}` : ''}`,
        productName: row.product.name,
        eventName: row.event?.name ?? null,
        provider: providerLabel,
        quantity: Math.abs(row.quantityChange),
        stockLevel: null,
        occurredAt: row.createdAt.toISOString(),
      };
    });

    const syncFeed: PosActivityFeedItem[] = syncRunRows
      .filter((row) => row.finishedAt)
      .map((row) => {
        const providerLabel = formatProviderLabel(row.connection.provider.toLowerCase());
        const terminal = row.connection.displayName ?? providerLabel;
        const statusWord = row.status === 'FAILED' ? 'failed' : 'completed';
        return {
          id: `sync-${row.id}`,
          kind: 'sync_run',
          message: `${providerLabel} sync ${statusWord} on ${terminal} — ${row.transactionsImported} transactions imported`,
          productName: null,
          eventName: null,
          provider: providerLabel,
          quantity: row.transactionsImported,
          stockLevel: null,
          occurredAt: row.finishedAt!.toISOString(),
        };
      });

    return [...inventoryFeed, ...syncFeed]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 50);
  }

  private async queryLowStockAlerts(
    vendorId: string,
    since: Date,
  ): Promise<PosLowStockAlert[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        product_name: string;
        event_id: string;
        event_name: string;
        quantity_remaining: number;
        last_change_at: Date;
        source: string | null;
      }>
    >(Prisma.sql`
      select
        p.id as product_id,
        p.name as product_name,
        e.id as event_id,
        e.name as event_name,
        pea.available_quantity_inperson as quantity_remaining,
        max(it.created_at) as last_change_at,
        max(it.source) as source
      from public.product_event_availability pea
      inner join public.products p on p.id = pea.product_id
      inner join public.events e on e.id = pea.event_id
      inner join public.inventory_transactions it
        on it.product_id = p.id
        and it.event_id = e.id
        and it.created_at >= ${since}
        and it.transaction_type in ('pos_inventory_sync', 'sale_pos')
      where p.vendor_id = ${vendorId}::uuid
        and pea.available_quantity_inperson <= ${LOW_STOCK_THRESHOLD}
      group by p.id, p.name, e.id, e.name, pea.available_quantity_inperson
      order by pea.available_quantity_inperson asc, max(it.created_at) desc
      limit 25
    `);

    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      eventId: row.event_id,
      eventName: row.event_name,
      quantityRemaining: Number(row.quantity_remaining),
      provider: formatProviderLabel(parseProviderFromSource(row.source)),
      lastChangeAt: new Date(row.last_change_at).toISOString(),
    }));
  }
}
