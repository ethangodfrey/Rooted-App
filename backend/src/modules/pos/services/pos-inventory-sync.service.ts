import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';

import {
  attachRailwayRedisLogs,
  resolveIoredisOptions,
} from '../../../common/redis/redis-connection';
import { PrismaService } from '../../../prisma/prisma.service';
import { POS_INVENTORY_TX_TYPE } from '../pos.constants';
import {
  POS_INVENTORY_COALESCE_MS,
  type PosInventoryFlushJobData,
  type PosInventoryOnlineSaleJobData,
  type PosInventoryWebhookJobData,
} from '../jobs/pos-inventory-queue.constants';

interface CoalescedInventoryState {
  deltaSum: number;
  absolute: number | null;
  vendorId: string;
  eventId: string;
  provider: string;
  providerCatalogObjectId: string;
}

export interface CoalesceResult {
  scheduledFlush: boolean;
  coalesceKey: string;
}

/**
 * Buffers bursty POS inventory webhooks and applies a single atomic database write
 * per product/event pair.
 *
 * Race-condition avoidance:
 * - Coalesce keys are per (productId, eventId); rapid webhooks merge in Redis via
 *   HINCRBY/HSET instead of issuing one UPDATE per webhook.
 * - Flush uses SQL `GREATEST(0, column + delta)` or `GREATEST(0, absolute)` so
 *   concurrent workers never read-then-write stale quantities.
 * - inventory_transactions audit rows use INSERT only (no update path), so
 *   duplicate flushes remain auditable without corrupting stock.
 */
@Injectable()
export class PosInventorySyncService implements OnModuleDestroy {
  private readonly logger = new Logger(PosInventorySyncService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const options = resolveIoredisOptions(this.config);
    if (options) {
      this.redis = new Redis(options);
      attachRailwayRedisLogs(this.redis, 'POS_INVENTORY_COALESCE');
      void this.redis.connect().catch((err: Error) => {
        this.logger.warn(`Redis unavailable for inventory coalesce: ${err.message}`);
        this.redis = null;
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  coalesceKey(productId: string, eventId: string): string {
    return `pos-inv:coalesce:${productId}:${eventId}`;
  }

  debounceKey(productId: string, eventId: string): string {
    return `pos-inv:debounce:${productId}:${eventId}`;
  }

  async resolveTarget(
    job: PosInventoryWebhookJobData,
  ): Promise<{ productId: string; eventId: string; vendorId: string } | null> {
    const connection = await this.prisma.posConnection.findFirst({
      where: {
        status: 'ACTIVE',
        provider: job.provider,
        ...(job.providerMerchantId
          ? { providerMerchantId: job.providerMerchantId }
          : {}),
        ...(job.providerLocationId && !job.providerMerchantId
          ? { providerLocationId: job.providerLocationId }
          : {}),
      },
      select: { id: true, vendorId: true },
    });
    if (!connection) return null;

    const mapping = await this.prisma.posProductMapping.findFirst({
      where: {
        connectionId: connection.id,
        providerCatalogObjectId: job.providerCatalogObjectId,
        ignored: false,
        productId: { not: null },
      },
      select: { productId: true },
    });
    if (!mapping?.productId) return null;

    const locationMapping = job.providerLocationId
      ? await this.prisma.posLocationMapping.findFirst({
          where: {
            connectionId: connection.id,
            providerLocationId: job.providerLocationId,
            eventId: { not: null },
          },
          select: { eventId: true },
        })
      : null;

    const eventId = locationMapping?.eventId;
    if (!eventId) return null;

    return { productId: mapping.productId, eventId, vendorId: connection.vendorId };
  }

  async bufferWebhook(
    job: PosInventoryWebhookJobData,
    target: { productId: string; eventId: string; vendorId: string },
  ): Promise<CoalesceResult> {
    const key = this.coalesceKey(target.productId, target.eventId);
    const debounce = this.debounceKey(target.productId, target.eventId);

    if (this.redis) {
      const multi = this.redis.multi();
      if (job.quantityDelta != null && Number.isFinite(job.quantityDelta)) {
        multi.hincrby(key, 'deltaSum', Math.trunc(job.quantityDelta));
      }
      if (job.quantityAbsolute != null && Number.isFinite(job.quantityAbsolute)) {
        multi.hset(key, 'absolute', Math.trunc(job.quantityAbsolute));
      }
      multi.hset(key, 'vendorId', target.vendorId);
      multi.hset(key, 'eventId', target.eventId);
      multi.hset(key, 'provider', job.provider);
      multi.hset(key, 'providerCatalogObjectId', job.providerCatalogObjectId);
      multi.expire(key, 120);
      await multi.exec();

      const scheduled = await this.redis.set(
        debounce,
        '1',
        'PX',
        POS_INVENTORY_COALESCE_MS,
        'NX',
      );
      return { scheduledFlush: scheduled === 'OK', coalesceKey: key };
    }

    await this.applyCoalescedState(target.productId, target.eventId, {
      deltaSum: job.quantityDelta ?? 0,
      absolute: job.quantityAbsolute ?? null,
      vendorId: target.vendorId,
      eventId: target.eventId,
      provider: job.provider,
      providerCatalogObjectId: job.providerCatalogObjectId,
    });
    return { scheduledFlush: false, coalesceKey: key };
  }

  async readCoalescedState(coalesceKey: string): Promise<CoalescedInventoryState | null> {
    if (!this.redis) return null;
    const raw = await this.redis.hgetall(coalesceKey);
    if (!raw.vendorId || !raw.eventId) return null;

    return {
      deltaSum: Number(raw.deltaSum ?? 0),
      absolute: raw.absolute != null ? Number(raw.absolute) : null,
      vendorId: raw.vendorId,
      eventId: raw.eventId,
      provider: raw.provider ?? 'unknown',
      providerCatalogObjectId: raw.providerCatalogObjectId ?? '',
    };
  }

  async clearCoalescedState(coalesceKey: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(coalesceKey);
  }

  async flushCoalesced(data: PosInventoryFlushJobData): Promise<void> {
    const state = await this.readCoalescedState(data.coalesceKey);
    if (!state) {
      this.logger.debug(`No coalesced inventory state for ${data.coalesceKey}`);
      return;
    }

    await this.applyCoalescedState(data.productId, data.eventId, state);
    await this.clearCoalescedState(data.coalesceKey);
  }

  private async applyCoalescedState(
    productId: string,
    eventId: string,
    state: CoalescedInventoryState,
  ): Promise<void> {
    const hasAbsolute = state.absolute != null && Number.isFinite(state.absolute);
    const delta = Math.trunc(state.deltaSum);

    if (!hasAbsolute && delta === 0) return;

    await this.prisma.$transaction(
      async (tx) => {
        if (hasAbsolute) {
          await tx.$executeRaw`
            UPDATE public.product_event_availability
            SET available_quantity_inperson = GREATEST(0, ${state.absolute!})
            WHERE product_id = ${productId}::uuid
              AND event_id = ${eventId}::uuid
          `;
        } else {
          await tx.$executeRaw`
            UPDATE public.product_event_availability
            SET available_quantity_inperson = GREATEST(0, available_quantity_inperson + ${delta})
            WHERE product_id = ${productId}::uuid
              AND event_id = ${eventId}::uuid
          `;
        }

        const change = hasAbsolute ? state.absolute! : delta;
        await tx.inventoryTransaction.create({
          data: {
            vendorId: state.vendorId,
            productId,
            eventId,
            transactionType: POS_INVENTORY_TX_TYPE,
            quantityChange: hasAbsolute ? 0 : change,
            source: `pos-inventory:${state.provider}:${state.providerCatalogObjectId}`,
            notes: hasAbsolute
              ? `POS absolute stock set to ${state.absolute}`
              : `POS coalesced delta ${change}`,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 10_000,
      },
    );

    this.logger.log(
      `Applied coalesced inventory for product ${productId} @ event ${eventId}`,
    );
  }

  /**
   * Applies an online storefront sale deduction across presale + in-person channels.
   * Keeps POS-linked stock aligned so Square/Toast registers cannot oversell.
   */
  async applyOnlineSaleDeduction(data: PosInventoryOnlineSaleJobData): Promise<void> {
    const qty = Math.trunc(data.quantity);
    if (qty <= 0) return;

    const providerLabel = data.provider?.toLowerCase() ?? 'online';
    const catalogSuffix = data.providerCatalogObjectId ? `:${data.providerCatalogObjectId}` : '';

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          UPDATE public.product_event_availability
          SET
            available_quantity_presale = GREATEST(0, available_quantity_presale - ${qty}),
            available_quantity_inperson = GREATEST(0, available_quantity_inperson - ${qty})
          WHERE product_id = ${data.productId}::uuid
            AND event_id = ${data.eventId}::uuid
        `;

        await tx.inventoryTransaction.create({
          data: {
            vendorId: data.vendorId,
            productId: data.productId,
            eventId: data.eventId,
            transactionType: 'sale_digital',
            quantityChange: -qty,
            source: `checkout:${providerLabel}${catalogSuffix}`,
            notes: `Online order ${data.orderId} — dual-channel deduct`,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            vendorId: data.vendorId,
            productId: data.productId,
            eventId: data.eventId,
            transactionType: POS_INVENTORY_TX_TYPE,
            quantityChange: -qty,
            source: `checkout-sync:${providerLabel}${catalogSuffix}`,
            notes: `POS channel sync after order ${data.orderId}`,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 10_000,
      },
    );

    this.logger.log(
      `Online sale deduct applied for order ${data.orderId} product ${data.productId} qty ${qty}`,
    );
  }
}
