/**
 * Multi-tenant subdomain parsing harness.
 * Simulates Host headers and asserts slug isolation + UNKNOWN_TENANT_CONTEXT.
 *
 * Path note: monorepo suite lives at backend/test/ (not apps/backend/).
 */

import { NotFoundException } from '@nestjs/common';

import {
  UNKNOWN_TENANT_CONTEXT,
  buildTenantHostContext,
  extractSubdomainSlug,
  normalizeHost,
} from '../src/modules/tenants/tenant-host.util';
import { TenantsService } from '../src/modules/tenants/tenants.service';

function log(message: string): void {
  // Uppercase text-only harness telemetry (no emoji).
  // eslint-disable-next-line no-console
  console.log(message);
}

describe('TENANT ROUTING HARNESS', () => {
  it('ROUTE_PASSED isolates spurs-suds from spurs-suds.localhost', () => {
    const context = buildTenantHostContext('spurs-suds.localhost:3000', 'rooted.app');
    expect(context.RESOLUTION).toBe('SUBDOMAIN');
    expect(context.SLUG).toBe('spurs-suds');
    expect(context.HOST).toBe('spurs-suds.localhost');
    log('ROUTE_PASSED TENANT_MATCH SLUG=spurs-suds');
  });

  it('ROUTE_PASSED isolates market-stall from market-stall.localhost', () => {
    const context = buildTenantHostContext('market-stall.localhost', 'localhost');
    expect(context.SLUG).toBe('market-stall');
    expect(context.RESOLUTION).toBe('SUBDOMAIN');
    expect(extractSubdomainSlug(context.HOST, 'localhost')).toBe('market-stall');
    log('ROUTE_PASSED TENANT_MATCH SLUG=market-stall');
  });

  it('ROUTE_PASSED strips www and ports before parsing', () => {
    expect(normalizeHost('WWW.Spurs-Suds.localhost:443')).toBe('spurs-suds.localhost');
    const context = buildTenantHostContext('www.vendor-demo.rooted.app:8443', 'rooted.app');
    expect(context.SLUG).toBe('vendor-demo');
    expect(context.PLATFORM_DOMAIN).toBe('rooted.app');
    log('ROUTE_PASSED TENANT_MATCH SLUG=vendor-demo');
  });

  it('ROUTE_PASSED rejects multi-level subdomains', () => {
    const context = buildTenantHostContext('a.b.rooted.app', 'rooted.app');
    expect(context.SLUG).toBeNull();
    expect(context.RESOLUTION).toBe('UNKNOWN');
    log('ROUTE_PASSED MULTI_LEVEL_REJECTED');
  });

  it('appends slug onto execution context for middleware consumers', () => {
    const headers = { host: 'spurs-suds.localhost' };
    const context = buildTenantHostContext(headers.host, 'localhost');
    const executionContext = {
      requestHost: headers.host,
      tenantSlug: context.SLUG,
      tenantResolution: context.RESOLUTION,
    };
    expect(executionContext.tenantSlug).toBe('spurs-suds');
    expect(executionContext.tenantResolution).toBe('SUBDOMAIN');
    log('ROUTE_PASSED CONTEXT_APPEND TENANT_MATCH');
  });

  it('UNKNOWN_TENANT_CONTEXT for invalid hostname token', () => {
    const context = buildTenantHostContext('not-a-tenant.example.com', 'rooted.app');
    expect(context.RESOLUTION).toBe('UNKNOWN');
    expect(context.SLUG).toBeNull();
    log('UNKNOWN_TENANT_CONTEXT INVALID_HOST');
  });

  it('UNKNOWN_TENANT_CONTEXT when resolveByHost finds no seeded tenant', async () => {
    const prisma = {
      tenantDomain: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenant: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TenantsService(prisma as never, cache as never);

    await expect(
      service.resolveByHost('ghost-tenant.localhost', 'localhost'),
    ).rejects.toBeInstanceOf(NotFoundException);

    try {
      await service.resolveByHost('ghost-tenant.localhost', 'localhost');
      throw new Error('EXPECTED_THROW');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(UNKNOWN_TENANT_CONTEXT);
      log('UNKNOWN_TENANT_CONTEXT UNSEEDED_TENANT');
    }
  });

  it('ROUTE_PASSED resolveByHost returns seeded subdomain tenant', async () => {
    const prisma = {
      tenantDomain: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          slug: 'spurs-suds',
          displayName: 'SPURS SUDS',
          status: 'ACTIVE',
          eventId: null,
          logoUrl: null,
          faviconUrl: null,
          primaryColor: null,
          accentColor: null,
          tagline: null,
          metadata: {},
          posIntegrations: [],
        }),
      },
    };
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TenantsService(prisma as never, cache as never);
    const resolved = await service.resolveByHost('spurs-suds.localhost', 'localhost');

    expect(resolved.resolution).toBe('subdomain');
    expect(resolved.tenant.slug).toBe('spurs-suds');
    expect(resolved.resolvedHost).toBe('spurs-suds.localhost');
    expect(cache.set).toHaveBeenCalled();
    log('ROUTE_PASSED TENANT_MATCH RESOLVED=spurs-suds');
  });
});
