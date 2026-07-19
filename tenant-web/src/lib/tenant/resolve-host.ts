const STATIC_EXTENSIONS = new Set([
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.css',
  '.js',
  '.map',
  '.woff',
  '.woff2',
  '.ttf',
  '.txt',
  '.xml',
]);

const INTERNAL_PREFIXES = [
  '/_next',
  '/api',
  '/api/health',
  '/api/health/readiness',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/tenant-error',
];

/** Structural platform roots — never rewritten to /[tenant] routes. */
export const RESERVED_SUBDOMAIN_SLUGS = new Set(['api', 'www', 'main']);

export function normalizeHost(rawHost: string): string {
  const withoutPort = rawHost.split(':')[0]?.trim().toLowerCase() ?? '';
  return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
}

export function shouldBypassMiddleware(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // Structural gateway probes — never tenant-rewrite these paths.
  if (
    normalized === '/api/health' ||
    normalized === '/api/health/readiness' ||
    normalized.startsWith('/api/health/')
  ) {
    return true;
  }

  if (
    INTERNAL_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const extension = normalized.slice(dotIndex).toLowerCase();
  return STATIC_EXTENSIONS.has(extension);
}

export function isReservedSubdomainSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return RESERVED_SUBDOMAIN_SLUGS.has(slug.trim().toLowerCase());
}

/**
 * DNS-safe single-label slug for city/state tenant hosts.
 * Dynamic — not an allowlist of regions or states.
 */
export const TENANT_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidTenantSubdomainSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  return TENANT_SUBDOMAIN_PATTERN.test(normalized);
}

/**
 * Extract a single-label tenant subdomain from `{slug}.{platformDomain}`.
 * Returns null for apex, multi-level hosts, reserved structural roots, and
 * invalid DNS labels. Any valid city/state-based slug maps into /[tenant].
 */
export function extractSubdomainSlug(host: string, platformDomain: string): string | null {
  if (!host.endsWith(`.${platformDomain}`)) return null;
  const slug = host.slice(0, -(platformDomain.length + 1));
  if (!slug || slug.includes('.')) return null;
  if (isReservedSubdomainSlug(slug)) return null;
  if (!isValidTenantSubdomainSlug(slug)) return null;
  return slug;
}

/**
 * Raw subdomain label before reserved filtering (for RESERVED bypass decisions).
 */
export function peekSubdomainLabel(host: string, platformDomain: string): string | null {
  if (!host.endsWith(`.${platformDomain}`)) return null;
  const slug = host.slice(0, -(platformDomain.length + 1));
  if (!slug || slug.includes('.')) return null;
  return slug;
}

export function isPlatformApex(host: string, platformDomain: string): boolean {
  return host === platformDomain;
}

export function isLocalDevHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

export function resolvePlatformDomain(): string {
  return (
    process.env.TENANT_PLATFORM_DOMAIN ?? 'vendorlymarketplace.com'
  )
    .trim()
    .toLowerCase();
}

export function resolveApiBaseUrl(): string {
  const base = (process.env.TENANT_API_URL ?? 'http://localhost:4000').trim();
  return base.replace(/\/$/, '');
}

export function tenantCacheKey(host: string): string {
  return `tenant:host:${host}`;
}

export const TENANT_CACHE_FRESH_MS = 60_000;
export const TENANT_CACHE_STALE_MS = 300_000;
