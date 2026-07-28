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
  // Reject underscored / unicode / overlong / punctuation labels early.
  if (normalized.length > 63) return false;
  if (/[^a-z0-9-]/.test(normalized)) return false;
  if (normalized.startsWith('-') || normalized.endsWith('-')) return false;
  if (normalized.includes('--')) return false;
  return TENANT_SUBDOMAIN_PATTERN.test(normalized);
}

export type SubdomainPreflightResult =
  | { OK: true; SLUG: string | null; KIND: 'APEX' | 'SUBDOMAIN' | 'LOCAL' | 'CUSTOM' }
  | { OK: false; REASON: 'INVALID_SLUG' | 'RESERVED' | 'EMPTY_HOST'; LABEL: string | null };

/**
 * Lightweight edge pre-flight for `*.vendorlymarketplace.com` hosts.
 * Rejects malicious / malformed subdomain labels before tenant API calls.
 */
export function preflightTenantHost(
  rawHost: string,
  platformDomain: string,
): SubdomainPreflightResult {
  const host = normalizeHost(rawHost);
  if (!host) {
    return { OK: false, REASON: 'EMPTY_HOST', LABEL: null };
  }

  if (isPlatformApex(host, platformDomain)) {
    return { OK: true, SLUG: null, KIND: 'APEX' };
  }

  const label =
    peekSubdomainLabel(host, platformDomain) ??
    (isLocalDevHost(host) && host.endsWith('.localhost')
      ? peekSubdomainLabel(host, 'localhost')
      : null);

  if (label) {
    if (isReservedSubdomainSlug(label)) {
      return { OK: false, REASON: 'RESERVED', LABEL: label };
    }
    if (!isValidTenantSubdomainSlug(label)) {
      return { OK: false, REASON: 'INVALID_SLUG', LABEL: label };
    }
    return {
      OK: true,
      SLUG: label,
      KIND: isLocalDevHost(host) ? 'LOCAL' : 'SUBDOMAIN',
    };
  }

  // Custom domains (no platform subdomain) proceed to resolver.
  return { OK: true, SLUG: null, KIND: 'CUSTOM' };
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

/**
 * Live Railway Nest API. Used when env is missing or points at loopback /
 * unresolved custom API DNS on Vercel edge / server runtimes.
 */
export const RAILWAY_PUBLIC_API_URL =
  'https://rooted-app-production-43fb.up.railway.app';

const DEV_LOOPBACK_API_URL = 'http://localhost:4000';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isLoopbackApiUrl(url: string): boolean {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True on Vercel (prod/preview) or NODE_ENV=production — never fetch loopback. */
export function isDeployedRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL === '1' || env.VERCEL === 'true') return true;
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return true;
  return env.NODE_ENV === 'production';
}

function firstConfiguredApiUrl(env: NodeJS.ProcessEnv): {
  url: string;
  source: string;
} | null {
  const keys = [
    'TENANT_API_URL',
    'NEXT_PUBLIC_API_URL',
    'VITE_API_URL',
    'PUBLIC_API_URL',
    'API_URL',
  ] as const;

  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { url: trimTrailingSlash(value), source: key };
  }
  return null;
}

/**
 * Remap custom API hosts that may not resolve until DNS cutover completes.
 * Matches web/src/lib/api-url.ts so edge and SPA hit the same Railway origin.
 */
function normalizeConfiguredApiUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'api.vendorlymarketplace.app' || host === 'api.vendorly.app') {
      return RAILWAY_PUBLIC_API_URL;
    }
  } catch {
    /* keep configured value */
  }
  return url;
}

let cachedApiBaseUrl: string | null = null;

/** Test helper — clears memoized API base between cases. */
export function resetApiBaseUrlCache(): void {
  cachedApiBaseUrl = null;
}

/**
 * Resolve Nest API base for edge middleware, SSR, and Nest proxies.
 * Never defaults to 127.0.0.1/localhost on deployed runtimes.
 */
export function resolveApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  // Memoize only for the live process.env path (edge hot path).
  if (env === process.env && cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  const deployed = isDeployedRuntime(env);
  const configured = firstConfiguredApiUrl(env);

  let source = configured?.source ?? 'NONE';
  let base = configured?.url ?? '';

  if (base && isLoopbackApiUrl(base) && deployed) {
    // eslint-disable-next-line no-console
    console.log(
      `LOCALHOST_FETCH_ELIMINATED SOURCE=${source} REJECTED=${base} REPLACED_WITH=${RAILWAY_PUBLIC_API_URL}`,
    );
    base = RAILWAY_PUBLIC_API_URL;
    source = 'RAILWAY_FALLBACK';
  }

  if (!base) {
    if (deployed) {
      base = RAILWAY_PUBLIC_API_URL;
      source = 'RAILWAY_FALLBACK';
    } else {
      base = DEV_LOOPBACK_API_URL;
      source = 'DEV_DEFAULT';
    }
  }

  const normalized = normalizeConfiguredApiUrl(base);
  if (normalized !== base) {
    // eslint-disable-next-line no-console
    console.log(
      `LOCALHOST_FETCH_ELIMINATED SOURCE=${source} REJECTED=${base} REPLACED_WITH=${normalized}`,
    );
    base = normalized;
    source = 'RAILWAY_DNS_FALLBACK';
  }

  const resolved = trimTrailingSlash(base);
  // eslint-disable-next-line no-console
  console.log(`API_URL_RESOLVED SOURCE=${source} URL=${resolved}`);

  if (env === process.env) {
    cachedApiBaseUrl = resolved;
  }
  return resolved;
}

export function tenantCacheKey(host: string): string {
  return `tenant:host:${host}`;
}

export const TENANT_CACHE_FRESH_MS = 60_000;
export const TENANT_CACHE_STALE_MS = 300_000;
