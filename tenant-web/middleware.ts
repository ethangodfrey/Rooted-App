import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

import { readTenantEnvelopeFromEdge } from '@/lib/tenant/edge-cache';
import {
  extractSubdomainSlug,
  isLocalDevHost,
  isPlatformApex,
  isReservedSubdomainSlug,
  isValidTenantSubdomainSlug,
  normalizeHost,
  peekSubdomainLabel,
  preflightTenantHost,
  resolveApiBaseUrl,
  resolvePlatformDomain,
  shouldBypassMiddleware,
} from '@/lib/tenant/resolve-host';
import { resolveTenantByHost } from '@/lib/tenant/tenant-service';
import { TenantNotFoundError, TenantSuspendedError } from '@/lib/tenant/types';

export const config = {
  // Exclude structural health + all /api/* from tenant rewrite/catch-all.
  // /api/health/readiness must never be rewritten to /[tenant]/api/...
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|readiness|api/|api$).*)',
  ],
};

const TENANT_HEADER_SLUG = 'x-tenant-slug';
const TENANT_HEADER_ID = 'x-tenant-id';
const TENANT_HEADER_HOST = 'x-resolved-host';
const TENANT_HEADER_RESOLUTION = 'x-tenant-resolution';
/** Downstream directory / theme context key (matches Market.directory_slug). */
const TENANT_HEADER_DIRECTORY_SLUG = 'x-directory-slug';

function tenantErrorRedirect(request: NextRequest, reason: string, host: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/tenant-error';
  url.search = '';
  url.searchParams.set('reason', reason);
  url.searchParams.set('host', host);
  return NextResponse.rewrite(url);
}

function withTenantHeaders(
  response: NextResponse,
  slug: string,
  tenantId: string,
  resolvedHost: string,
  resolution: string,
): NextResponse {
  response.headers.set(TENANT_HEADER_SLUG, slug);
  response.headers.set(TENANT_HEADER_ID, tenantId);
  response.headers.set(TENANT_HEADER_HOST, resolvedHost);
  response.headers.set(TENANT_HEADER_RESOLUTION, resolution);
  // Pass parsed host slug straight into directory API / layout context.
  response.headers.set(TENANT_HEADER_DIRECTORY_SLUG, slug);
  return response;
}

async function triggerBackgroundRevalidation(
  host: string,
  event: NextFetchEvent,
): Promise<void> {
  const base = resolveApiBaseUrl();
  const secret = process.env.TENANT_REVALIDATE_SECRET?.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (secret) headers['x-tenant-revalidate-secret'] = secret;

  event.waitUntil(
    fetch(`${base}/tenants/resolve?host=${encodeURIComponent(host)}&revalidate=1`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    }).catch(() => undefined),
  );
}

function logTenantResolved(slug: string, host: string, resolution: string): void {
  // Uppercase text-only edge tracing (no emoji).
  // eslint-disable-next-line no-console
  console.log(`TENANT_RESOLVED SLUG=${slug} HOST=${host} RESOLUTION=${resolution}`);
}

export async function middleware(request: NextRequest, event: NextFetchEvent): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (shouldBypassMiddleware(pathname)) {
    return NextResponse.next();
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = request.headers.get('host');
  const rawHost = forwardedHost?.split(',')[0]?.trim() || hostHeader || '';
  const platformDomain = resolvePlatformDomain();
  const normalizedHost = normalizeHost(rawHost);

  if (!normalizedHost) {
    // eslint-disable-next-line no-console
    console.log('FALLBACK_TRIGGERED REASON=MISSING_HOST');
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return tenantErrorRedirect(request, 'missing_host', '');
  }

  // Pre-flight: reject malformed / malicious subdomain labels before rewrites.
  const preflight = preflightTenantHost(normalizedHost, platformDomain);
  if (!preflight.OK) {
    if (preflight.REASON === 'RESERVED') {
      // eslint-disable-next-line no-console
      console.log(
        `TENANT_BYPASS RESERVED_SUBDOMAIN SLUG=${preflight.LABEL} HOST=${normalizedHost}`,
      );
      return NextResponse.next();
    }

    // eslint-disable-next-line no-console
    console.log(
      `FALLBACK_TRIGGERED REASON=${preflight.REASON} LABEL=${preflight.LABEL ?? 'NONE'} HOST=${normalizedHost}`,
    );
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return tenantErrorRedirect(
      request,
      preflight.REASON === 'INVALID_SLUG' ? 'invalid_slug' : 'not_found',
      normalizedHost,
    );
  }

  // Reserved structural subdomains (api / www / main) — no tenant rewrite.
  const reservedLabel =
    peekSubdomainLabel(normalizedHost, platformDomain) ??
    (isLocalDevHost(normalizedHost) && normalizedHost.endsWith('.localhost')
      ? peekSubdomainLabel(normalizedHost, 'localhost')
      : null);
  if (isReservedSubdomainSlug(reservedLabel)) {
    // eslint-disable-next-line no-console
    console.log(`TENANT_BYPASS RESERVED_SUBDOMAIN SLUG=${reservedLabel} HOST=${normalizedHost}`);
    return NextResponse.next();
  }

  if (isPlatformApex(normalizedHost, platformDomain) && !isLocalDevHost(normalizedHost)) {
    return NextResponse.next();
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0] ?? null;
  const subdomainSlug =
    preflight.SLUG ??
    extractSubdomainSlug(normalizedHost, platformDomain) ??
    (isLocalDevHost(normalizedHost) && normalizedHost.endsWith('.localhost')
      ? extractSubdomainSlug(normalizedHost, 'localhost')
      : null);

  // Guard path-segment tenant tokens the same way as host labels.
  if (firstSegment && !isValidTenantSubdomainSlug(firstSegment) && firstSegment !== 'tenant-error') {
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=INVALID_PATH_SLUG SLUG=${firstSegment}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return tenantErrorRedirect(request, 'invalid_slug', normalizedHost);
  }

  try {
    let envelope = null as Awaited<ReturnType<typeof resolveTenantByHost>> | null;

    const edgeCached = await readTenantEnvelopeFromEdge(normalizedHost);
    if (edgeCached && edgeCached.freshness !== 'expired') {
      envelope = edgeCached.envelope;
      if (edgeCached.freshness === 'stale') {
        await triggerBackgroundRevalidation(normalizedHost, event);
      }
    }

    if (!envelope) {
      envelope = await resolveTenantByHost(normalizedHost);
    }

    const { tenant, resolvedHost, resolution } = envelope;
    const tenantSlug = tenant.slug;

    // Prefer host subdomain mapping when present; otherwise use resolved tenant slug.
    // No state/city allowlist — any valid DNS label rewrites into app/[tenant]/...
    const rewriteSlug = subdomainSlug ?? tenantSlug;

    if (!isValidTenantSubdomainSlug(rewriteSlug)) {
      // eslint-disable-next-line no-console
      console.log(`FALLBACK_TRIGGERED REASON=INVALID_REWRITE_SLUG SLUG=${rewriteSlug}`);
      // eslint-disable-next-line no-console
      console.log('TENANT_NOT_FOUND');
      return tenantErrorRedirect(request, 'invalid_slug', resolvedHost);
    }

    // eslint-disable-next-line no-console
    console.log(
      `NATIONWIDE_ROUTING_ACTIVE SLUG=${rewriteSlug} HOST=${resolvedHost} RESOLUTION=${resolution}`,
    );
    logTenantResolved(rewriteSlug, resolvedHost, resolution);

    if (firstSegment === rewriteSlug) {
      const response = NextResponse.next();
      return withTenantHeaders(response, rewriteSlug, tenant.id, resolvedHost, resolution);
    }

    // Rewrite into the dynamic tenant segment: app/[tenant]/...
    const rewriteUrl = request.nextUrl.clone();
    const suffix = pathname === '/' ? '' : pathname;
    rewriteUrl.pathname = `/${rewriteSlug}${suffix}`;

    const response = NextResponse.rewrite(rewriteUrl);
    return withTenantHeaders(response, rewriteSlug, tenant.id, resolvedHost, resolution);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      // eslint-disable-next-line no-console
      console.log(`FALLBACK_TRIGGERED REASON=UNSEEDED_HOST HOST=${error.host}`);
      // eslint-disable-next-line no-console
      console.log('TENANT_NOT_FOUND');
      return tenantErrorRedirect(request, 'not_found', error.host);
    }
    if (error instanceof TenantSuspendedError) {
      // eslint-disable-next-line no-console
      console.log(`FALLBACK_TRIGGERED REASON=SUSPENDED SLUG=${error.slug}`);
      return tenantErrorRedirect(request, 'suspended', normalizedHost);
    }
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=RESOLVE_FAILED HOST=${normalizedHost}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return tenantErrorRedirect(request, 'resolve_failed', normalizedHost);
  }
}
