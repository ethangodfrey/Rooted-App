import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { UNKNOWN_TENANT_CONTEXT } from './tenant-host.util';
import { TenantCacheService } from './tenant-cache.service';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly cache: TenantCacheService,
    private readonly config: ConfigService,
  ) {}

  private platformDomain(): string {
    return this.config.get<string>('TENANT_PLATFORM_DOMAIN', 'rooted.app').trim().toLowerCase();
  }

  @Get('resolve')
  async resolve(
    @Query('host') hostQuery: string | undefined,
    @Headers('x-forwarded-host') forwardedHost: string | undefined,
    @Headers('host') requestHost: string | undefined,
    @Query('revalidate') revalidate: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawHost = hostQuery?.trim() || forwardedHost?.split(',')[0]?.trim() || requestHost;
    if (!rawHost) {
      throw new NotFoundException(UNKNOWN_TENANT_CONTEXT);
    }

    const normalized = this.tenants.normalizeHost(rawHost);
    const forceRefresh = revalidate === '1' || revalidate === 'true';

    if (!forceRefresh) {
      const cached = await this.cache.get(normalized);
      if (cached) {
        const freshness = cached.freshness;
        res.setHeader('X-Tenant-Cache', freshness);
        if (freshness === 'stale') {
          res.setHeader('X-Tenant-Revalidate', 'background');
        }
        if (freshness !== 'expired') {
          return {
            tenant: cached.envelope.tenant,
            resolvedHost: cached.envelope.resolvedHost,
            resolution: cached.envelope.resolution,
            cache: freshness,
          };
        }
      }
    }

    const resolved = await this.tenants.resolveByHost(normalized, this.platformDomain(), {
      forceRefresh,
    });
    res.setHeader('X-Tenant-Cache', forceRefresh ? 'refresh' : 'miss');
    return { ...resolved, cache: forceRefresh ? 'refresh' : 'miss' };
  }

  @Get('by-slug/:slug')
  async bySlug(@Param('slug') slug: string) {
    const tenant = await this.tenants.getBySlug(slug);
    return { tenant };
  }
}
