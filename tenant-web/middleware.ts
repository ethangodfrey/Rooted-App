import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

import { readTenantEnvelopeFromEdge } from '@/lib/tenant/edge-cache';
import {
  isLocalDevHost,
  isPlatformApex,
  normalizeHost,
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
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/|api$).*)',
  ],
};

const TENANT_HEADER_SLUG = 'x-tenant-slug';
const TENANT_HEADER_ID = 'x-tenant-id';
const TENANT_HEADER_HOST = 'x-resolved-host';

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
): NextResponse {
  response.headers.set(TENANT_HEADER_SLUG, slug);
  response.headers.set(TENANT_HEADER_ID, tenantId);
  response.headers.set(TENANT_HEADER_HOST, resolvedHost);
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
    return tenantErrorRedirect(request, 'missing_host', '');
  }

  if (isPlatformApex(normalizedHost, platformDomain) && !isLocalDevHost(normalizedHost)) {
    return NextResponse.next();
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0] ?? null;

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

    const { tenant, resolvedHost } = envelope;
    const tenantSlug = tenant.slug;

    if (firstSegment === tenantSlug) {
      const response = NextResponse.next();
      return withTenantHeaders(response, tenantSlug, tenant.id, resolvedHost);
    }

    const rewriteUrl = request.nextUrl.clone();
    const suffix = pathname === '/' ? '' : pathname;
    rewriteUrl.pathname = `/${tenantSlug}${suffix}`;

    const response = NextResponse.rewrite(rewriteUrl);
    return withTenantHeaders(response, tenantSlug, tenant.id, resolvedHost);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return tenantErrorRedirect(request, 'not_found', error.host);
    }
    if (error instanceof TenantSuspendedError) {
      return tenantErrorRedirect(request, 'suspended', normalizedHost);
    }
    return tenantErrorRedirect(request, 'resolve_failed', normalizedHost);
  }
}
