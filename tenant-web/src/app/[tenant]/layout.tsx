import { headers } from 'next/headers';

import { MarketThemeErrorBoundary } from '@/components/tenant/MarketThemeErrorBoundary';
import { TenantNotFoundFallback } from '@/components/tenant/TenantNotFoundFallback';
import { getMarketDirectoryBySlug } from '@/lib/markets/directory';
import {
  MarketThemeProvider,
  buildMarketThemeValue,
} from '@/lib/tenant/market-theme';
import { isValidTenantSubdomainSlug } from '@/lib/tenant/resolve-host';
import { TenantProvider } from '@/lib/tenant/use-tenant';
import { getTenantBySlug } from '@/lib/tenant/tenant-service';
import { TenantNotFoundError, TenantSuspendedError } from '@/lib/tenant/types';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const requestHeaders = await headers();
  const resolvedHost =
    requestHeaders.get('x-resolved-host') ??
    requestHeaders.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    requestHeaders.get('host') ??
    slug;

  if (!isValidTenantSubdomainSlug(slug)) {
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=INVALID_LAYOUT_SLUG SLUG=${slug}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return (
      <TenantNotFoundFallback host={resolvedHost} slug={slug} detail="INVALID_SLUG" />
    );
  }

  const directorySlugHeader = requestHeaders.get('x-directory-slug')?.trim().toLowerCase() ?? '';
  const directoryLookupSlug = directorySlugHeader || slug;

  if (!directoryLookupSlug || !isValidTenantSubdomainSlug(directoryLookupSlug)) {
    // eslint-disable-next-line no-console
    console.log(
      `FALLBACK_TRIGGERED REASON=EMPTY_DIRECTORY_SLUG SLUG=${slug} DIRECTORY=${directoryLookupSlug || 'NONE'}`,
    );
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return (
      <TenantNotFoundFallback
        host={resolvedHost}
        slug={slug}
        detail="EMPTY_DIRECTORY_SLUG"
      />
    );
  }

  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (error) {
    if (error instanceof TenantNotFoundError || error instanceof TenantSuspendedError) {
      // eslint-disable-next-line no-console
      console.log(`FALLBACK_TRIGGERED REASON=TENANT_RESOLVE_MISS SLUG=${slug}`);
      // eslint-disable-next-line no-console
      console.log('TENANT_NOT_FOUND');
      return (
        <TenantNotFoundFallback
          host={resolvedHost}
          slug={slug}
          detail={error instanceof TenantSuspendedError ? 'SUSPENDED' : 'UNSEEDED'}
        />
      );
    }
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=TENANT_RESOLVE_ERROR SLUG=${slug}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return (
      <TenantNotFoundFallback
        host={resolvedHost}
        slug={slug}
        detail="RESOLVE_ERROR"
      />
    );
  }

  if (tenant.slug !== slug) {
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=SLUG_MISMATCH SLUG=${slug}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return (
      <TenantNotFoundFallback host={resolvedHost} slug={slug} detail="SLUG_MISMATCH" />
    );
  }

  const resolutionHeader = requestHeaders.get('x-tenant-resolution');
  const resolution =
    resolutionHeader === 'custom_domain' ||
    resolutionHeader === 'subdomain' ||
    resolutionHeader === 'slug_path'
      ? resolutionHeader
      : 'slug_path';

  let market = null;
  try {
    market = await getMarketDirectoryBySlug(directoryLookupSlug);
  } catch {
    // eslint-disable-next-line no-console
    console.log(
      `FALLBACK_TRIGGERED REASON=DIRECTORY_LOOKUP_FAILED DIRECTORY=${directoryLookupSlug}`,
    );
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return (
      <TenantNotFoundFallback
        host={resolvedHost}
        slug={slug}
        detail="DIRECTORY_LOOKUP_FAILED"
      />
    );
  }

  let theme;
  try {
    theme = buildMarketThemeValue({
      tenant,
      market,
      resolvedHost,
      resolution,
    });
  } catch {
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=THEME_BUILD_FAILED SLUG=${slug}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
    return (
      <TenantNotFoundFallback
        host={resolvedHost}
        slug={slug}
        detail="THEME_BUILD_FAILED"
      />
    );
  }

  // Uppercase text-only layout tracing (no emoji).
  // eslint-disable-next-line no-console
  console.log(
    `THEME_INJECTED_OK SLUG=${slug} DIRECTORY=${directoryLookupSlug} MARKET=${market?.directorySlug ?? market?.slug ?? 'NONE'} PRIMARY=${theme.primaryColor}`,
  );

  return (
    <TenantProvider
      value={{
        tenant,
        market,
        resolvedHost,
        resolution,
      }}
    >
      <MarketThemeErrorBoundary host={resolvedHost} slug={slug}>
        <MarketThemeProvider value={theme}>{children}</MarketThemeProvider>
      </MarketThemeErrorBoundary>
    </TenantProvider>
  );
}
