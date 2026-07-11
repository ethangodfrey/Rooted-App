import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TenantCacheService } from './tenant-cache.service';
import type { TenantConfig, TenantResolveResult } from './tenant.types';

const TENANT_INCLUDE = {
  posIntegrations: {
    where: { active: true },
    select: {
      provider: true,
      status: true,
      providerAppId: true,
      providerLocationId: true,
      webhookEndpoint: true,
      metadata: true,
    },
  },
} as const;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TenantCacheService,
  ) {}

  normalizeHost(rawHost: string): string {
    const withoutPort = rawHost.split(':')[0]?.trim().toLowerCase() ?? '';
    return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
  }

  extractSubdomainSlug(host: string, platformDomain: string): string | null {
    if (!host.endsWith(`.${platformDomain}`)) return null;
    const slug = host.slice(0, -(platformDomain.length + 1));
    if (!slug || slug.includes('.')) return null;
    return slug;
  }

  mapTenant(row: {
    id: string;
    slug: string;
    displayName: string;
    status: TenantStatus;
    eventId: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    tagline: string | null;
    metadata: unknown;
    posIntegrations: Array<{
      provider: TenantConfig['posIntegrations'][number]['provider'];
      status: TenantConfig['posIntegrations'][number]['status'];
      providerAppId: string | null;
      providerLocationId: string | null;
      webhookEndpoint: string | null;
      metadata: unknown;
    }>;
  }): TenantConfig {
    return {
      id: row.id,
      slug: row.slug,
      displayName: row.displayName,
      status: row.status,
      eventId: row.eventId,
      branding: {
        logoUrl: row.logoUrl,
        faviconUrl: row.faviconUrl,
        primaryColor: row.primaryColor,
        accentColor: row.accentColor,
        tagline: row.tagline,
      },
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      posIntegrations: row.posIntegrations.map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        providerAppId: integration.providerAppId,
        providerLocationId: integration.providerLocationId,
        webhookEndpoint: integration.webhookEndpoint,
        metadata: (integration.metadata ?? null) as Record<string, unknown> | null,
      })),
    };
  }

  async findByHostFromDb(host: string, platformDomain: string): Promise<TenantResolveResult | null> {
    const normalized = this.normalizeHost(host);

    const domainRow = await this.prisma.tenantDomain.findFirst({
      where: {
        host: normalized,
        verified: true,
        tenant: { status: TenantStatus.ACTIVE },
      },
      include: { tenant: { include: TENANT_INCLUDE } },
    });

    if (domainRow) {
      return {
        tenant: this.mapTenant(domainRow.tenant),
        resolvedHost: normalized,
        resolution: 'custom_domain',
      };
    }

    const subdomainSlug = this.extractSubdomainSlug(normalized, platformDomain);
    if (subdomainSlug) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { slug: subdomainSlug, status: TenantStatus.ACTIVE },
        include: TENANT_INCLUDE,
      });
      if (tenant) {
        return {
          tenant: this.mapTenant(tenant),
          resolvedHost: normalized,
          resolution: 'subdomain',
        };
      }
    }

    return null;
  }

  async findBySlugFromDb(slug: string): Promise<TenantConfig | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, status: TenantStatus.ACTIVE },
      include: TENANT_INCLUDE,
    });
    return tenant ? this.mapTenant(tenant) : null;
  }

  async resolveByHost(
    rawHost: string,
    platformDomain: string,
    options?: { forceRefresh?: boolean },
  ): Promise<TenantResolveResult> {
    const normalized = this.normalizeHost(rawHost);

    if (!options?.forceRefresh) {
      const cached = await this.cache.get(normalized);
      if (cached && cached.freshness !== 'expired') {
        return {
          tenant: cached.envelope.tenant,
          resolvedHost: cached.envelope.resolvedHost,
          resolution: cached.envelope.resolution,
        };
      }
    }

    const resolved = await this.findByHostFromDb(normalized, platformDomain);
    if (!resolved) {
      throw new NotFoundException(`No active tenant for host "${normalized}"`);
    }

    await this.cache.set(normalized, resolved.tenant, resolved.resolution);
    return resolved;
  }

  async getBySlug(slug: string): Promise<TenantConfig> {
    const cached = await this.cache.get(slug);
    if (cached && cached.freshness !== 'expired') {
      return cached.envelope.tenant;
    }

    const tenant = await this.findBySlugFromDb(slug);
    if (!tenant) {
      throw new NotFoundException(`No active tenant with slug "${slug}"`);
    }

    await this.cache.set(slug, tenant, 'slug_path');
    return tenant;
  }
}
