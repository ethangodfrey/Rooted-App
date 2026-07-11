import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

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

  return (
    <TenantProvider
      value={{
        tenant,
        resolvedHost,
        resolution,
      }}
    >
      <div
        style={{
          ['--tenant-primary' as string]: tenant.branding.primaryColor ?? '#1f6b4f',
          ['--tenant-accent' as string]: tenant.branding.accentColor ?? '#e8a838',
        }}
      >
        {children}
      </div>
    </TenantProvider>
  );
}
