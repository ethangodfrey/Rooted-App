import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getMarketDirectoryBySlug } from '@/lib/markets/directory';
import {
  MarketThemeProvider,
  buildMarketThemeValue,
} from '@/lib/tenant/market-theme';
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

  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (error) {
    if (error instanceof TenantNotFoundError || error instanceof TenantSuspendedError) {
      notFound();
    }
    throw error;
  }

  if (tenant.slug !== slug) {
    notFound();
  }

  const resolutionHeader = requestHeaders.get('x-tenant-resolution');
  const resolution =
    resolutionHeader === 'custom_domain' ||
    resolutionHeader === 'subdomain' ||
    resolutionHeader === 'slug_path'
      ? resolutionHeader
      : 'slug_path';

  const market = await getMarketDirectoryBySlug(slug);
  const theme = buildMarketThemeValue({
    tenant,
    market,
    resolvedHost,
    resolution,
  });

  // Uppercase text-only layout tracing (no emoji).
  // eslint-disable-next-line no-console
  console.log(
    `THEME_INJECTED_OK SLUG=${slug} MARKET=${market?.directorySlug ?? market?.slug ?? 'NONE'} PRIMARY=${theme.primaryColor}`,
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
      <MarketThemeProvider value={theme}>{children}</MarketThemeProvider>
    </TenantProvider>
  );
}
