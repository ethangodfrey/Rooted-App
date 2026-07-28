import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import {
  attachRailwayRedisLogs,
  resolveIoredisOptions,
} from '../../common/redis/redis-connection';
import type { TenantCacheEnvelope, TenantConfig } from './tenant.types';

/** Fresh window: serve without background revalidation. */
export const TENANT_CACHE_FRESH_MS = 60_000;
/** Stale window: serve cached value while revalidating in the background. */
export const TENANT_CACHE_STALE_MS = 300_000;
/** Redis TTL — keep serialized envelope for edge + API consumers. */
export const TENANT_CACHE_REDIS_TTL_SEC = 3_600;

export function tenantCacheKey(host: string): string {
  return `tenant:host:${host}`;
}

interface MemoryEntry {
  envelope: TenantCacheEnvelope;
}

@Injectable()
export class TenantCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantCacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const options = resolveIoredisOptions(this.config);
    if (options) {
      this.redis = new Redis(options);
      attachRailwayRedisLogs(this.redis, 'TENANT_CACHE');
      void this.redis.connect().catch((err: Error) => {
        this.logger.warn(`Redis unavailable for tenant cache: ${err.message}`);
        this.redis = null;
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  getFreshness(envelope: TenantCacheEnvelope, now = Date.now()): 'fresh' | 'stale' | 'expired' {
    const age = now - envelope.fetchedAt;
    if (age <= TENANT_CACHE_FRESH_MS) return 'fresh';
    if (age <= TENANT_CACHE_STALE_MS) return 'stale';
    return 'expired';
  }

  readMemory(host: string): TenantCacheEnvelope | null {
    const entry = this.memory.get(host);
    return entry?.envelope ?? null;
  }

  writeMemory(host: string, envelope: TenantCacheEnvelope): void {
    this.memory.set(host, { envelope });
  }

  async readRedis(host: string): Promise<TenantCacheEnvelope | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(tenantCacheKey(host));
      if (!raw) return null;
      return JSON.parse(raw) as TenantCacheEnvelope;
    } catch (err) {
      this.logger.debug(`Redis read failed for ${host}: ${(err as Error).message}`);
      return null;
    }
  }

  async writeRedis(host: string, envelope: TenantCacheEnvelope): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        tenantCacheKey(host),
        JSON.stringify(envelope),
        'EX',
        TENANT_CACHE_REDIS_TTL_SEC,
      );
    } catch (err) {
      this.logger.debug(`Redis write failed for ${host}: ${(err as Error).message}`);
    }
  }

  async get(host: string): Promise<{ envelope: TenantCacheEnvelope; freshness: 'fresh' | 'stale' | 'expired' } | null> {
    const normalized = host.toLowerCase();
    const memoryHit = this.readMemory(normalized);
    if (memoryHit) {
      return { envelope: memoryHit, freshness: this.getFreshness(memoryHit) };
    }

    const redisHit = await this.readRedis(normalized);
    if (redisHit) {
      this.writeMemory(normalized, redisHit);
      return { envelope: redisHit, freshness: this.getFreshness(redisHit) };
    }

    return null;
  }

  async set(
    host: string,
    tenant: TenantConfig,
    resolution: TenantCacheEnvelope['resolution'],
  ): Promise<TenantCacheEnvelope> {
    const normalized = host.toLowerCase();
    const envelope: TenantCacheEnvelope = {
      fetchedAt: Date.now(),
      tenant,
      resolvedHost: normalized,
      resolution,
    };
    this.writeMemory(normalized, envelope);
    await this.writeRedis(normalized, envelope);
    return envelope;
  }

  async invalidate(host: string): Promise<void> {
    const normalized = host.toLowerCase();
    this.memory.delete(normalized);
    if (!this.redis) return;
    try {
      await this.redis.del(tenantCacheKey(normalized));
    } catch (err) {
      this.logger.debug(`Redis delete failed for ${normalized}: ${(err as Error).message}`);
    }
  }
}
