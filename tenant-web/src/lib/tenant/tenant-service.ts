import {
  getEnvelopeFreshness,
  readTenantEnvelopeFromEdge,
  writeTenantEnvelopeToEdge,
} from './edge-cache';
import {
  extractSubdomainSlug,
  isLocalDevHost,
  isPlatformApex,
  normalizeHost,
  resolveApiBaseUrl,
  resolvePlatformDomain,
} from './resolve-host';
import type { TenantCacheEnvelope, TenantConfig, TenantResolveResponse } from './types';
import { TenantNotFoundError, TenantSuspendedError } from './types';

const memoryCache = new Map<string, TenantCacheEnvelope>();

function readMemory(host: string): TenantCacheEnvelope | null {
  return memoryCache.get(host) ?? null;
}

function writeMemory(host: string, envelope: TenantCacheEnvelope): void {
  memoryCache.set(host, envelope);
}

async function fetchTenantFromApi(
  host: string,
  options?: { revalidate?: boolean },
): Promise<TenantResolveResponse> {
  const base = resolveApiBaseUrl();
  const params = new URLSearchParams({ host });
  if (options?.revalidate) params.set('revalidate', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(`${base}/tenants/resolve?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status === 404) {
      throw new TenantNotFoundError(host);
    }

    if (!response.ok) {
      throw new Error(`Tenant API returned ${response.status}`);
    }

    return (await response.json()) as TenantResolveResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function toEnvelope(result: TenantResolveResponse): TenantCacheEnvelope {
  return {
    fetchedAt: Date.now(),
    tenant: result.tenant,
    resolvedHost: result.resolvedHost,
    resolution: result.resolution,
  };
}

function assertTenantActive(tenant: TenantConfig): void {
  if (tenant.status !== 'ACTIVE') {
    throw new TenantSuspendedError(tenant.slug);
  }
}

export async function resolveTenantByHost(
  rawHost: string,
  options?: { forceRefresh?: boolean },
): Promise<TenantCacheEnvelope> {
  const platformDomain = resolvePlatformDomain();
  const normalized = normalizeHost(rawHost);

  if (isLocalDevHost(normalized)) {
    const devSlug = (process.env.TENANT_DEV_SLUG ?? 'vendorly').trim();
    const devHost = `${devSlug}.${platformDomain}`;
    return resolveTenantByHost(devHost, options);
  }

  if (isPlatformApex(normalized, platformDomain)) {
    throw new TenantNotFoundError(normalized);
  }

  if (!options?.forceRefresh) {
    const memoryHit = readMemory(normalized);
    if (memoryHit) {
      const freshness = getEnvelopeFreshness(memoryHit);
      if (freshness !== 'expired') {
        assertTenantActive(memoryHit.tenant);
        return memoryHit;
      }
    }

    const edgeHit = await readTenantEnvelopeFromEdge(normalized);
    if (edgeHit && edgeHit.freshness !== 'expired') {
      writeMemory(normalized, edgeHit.envelope);
      assertTenantActive(edgeHit.envelope.tenant);
      return edgeHit.envelope;
    }
  }

  const apiResult = await fetchTenantFromApi(normalized, {
    revalidate: options?.forceRefresh,
  });
  assertTenantActive(apiResult.tenant);

  const envelope = toEnvelope(apiResult);
  writeMemory(normalized, envelope);
  await writeTenantEnvelopeToEdge(normalized, envelope);
  return envelope;
}

export async function getTenantBySlug(slug: string): Promise<TenantConfig> {
  const base = resolveApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(`${base}/tenants/by-slug/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status === 404) {
      throw new TenantNotFoundError(slug);
    }

    if (!response.ok) {
      throw new Error(`Tenant slug API returned ${response.status}`);
    }

    const body = (await response.json()) as { tenant: TenantConfig };
    assertTenantActive(body.tenant);
    return body.tenant;
  } finally {
    clearTimeout(timeout);
  }
}

export function inferSlugFromHost(host: string): string | null {
  const platformDomain = resolvePlatformDomain();
  const normalized = normalizeHost(host);
  return extractSubdomainSlug(normalized, platformDomain);
}
