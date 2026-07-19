/**
 * Pure tenant hostname parsing helpers (no Nest DI).
 * Used by TenantsService and the tenant-routing test harness.
 */

/** Structural platform roots — never treated as marketplace tenant slugs. */
export const RESERVED_SUBDOMAIN_SLUGS = new Set(['api', 'www', 'main']);

export type TenantHostContext = {
  HOST: string;
  SLUG: string | null;
  PLATFORM_DOMAIN: string;
  RESOLUTION: 'SUBDOMAIN' | 'APEX' | 'UNKNOWN' | 'RESERVED';
};

export function normalizeHost(rawHost: string): string {
  const withoutPort = rawHost.split(':')[0]?.trim().toLowerCase() ?? '';
  return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
}

export function isReservedSubdomainSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return RESERVED_SUBDOMAIN_SLUGS.has(slug.trim().toLowerCase());
}

export function extractSubdomainSlug(
  host: string,
  platformDomain: string,
): string | null {
  if (!host.endsWith(`.${platformDomain}`)) return null;
  const slug = host.slice(0, -(platformDomain.length + 1));
  if (!slug || slug.includes('.')) return null;
  if (isReservedSubdomainSlug(slug)) return null;
  return slug;
}

export function isLocalDevHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost')
  );
}

/**
 * Isolates the tenant prefix token from a simulated Host header and
 * appends it to a structured execution context.
 */
export function buildTenantHostContext(
  rawHost: string,
  platformDomain: string,
): TenantHostContext {
  const host = normalizeHost(rawHost);
  const platform = platformDomain.trim().toLowerCase();

  if (host.endsWith(`.${platform}`)) {
    const rawSlug = host.slice(0, -(platform.length + 1));
    if (rawSlug && !rawSlug.includes('.') && isReservedSubdomainSlug(rawSlug)) {
      return {
        HOST: host,
        SLUG: null,
        PLATFORM_DOMAIN: platform,
        RESOLUTION: 'RESERVED',
      };
    }
  }

  const slug = extractSubdomainSlug(host, platform);

  if (slug) {
    return {
      HOST: host,
      SLUG: slug,
      PLATFORM_DOMAIN: platform,
      RESOLUTION: 'SUBDOMAIN',
    };
  }

  if (host === platform) {
    return {
      HOST: host,
      SLUG: null,
      PLATFORM_DOMAIN: platform,
      RESOLUTION: 'APEX',
    };
  }

  // Local multi-tenant form: {slug}.localhost
  if (isLocalDevHost(host) && host.endsWith('.localhost')) {
    const localRaw = host.slice(0, -('.localhost'.length));
    if (localRaw && !localRaw.includes('.') && isReservedSubdomainSlug(localRaw)) {
      return {
        HOST: host,
        SLUG: null,
        PLATFORM_DOMAIN: 'localhost',
        RESOLUTION: 'RESERVED',
      };
    }
    const localSlug = extractSubdomainSlug(host, 'localhost');
    if (localSlug) {
      return {
        HOST: host,
        SLUG: localSlug,
        PLATFORM_DOMAIN: 'localhost',
        RESOLUTION: 'SUBDOMAIN',
      };
    }
  }

  return {
    HOST: host,
    SLUG: null,
    PLATFORM_DOMAIN: platform,
    RESOLUTION: 'UNKNOWN',
  };
}

export const UNKNOWN_TENANT_CONTEXT = 'UNKNOWN_TENANT_CONTEXT';
