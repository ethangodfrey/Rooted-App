import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getTenantBySlug } from '@/lib/tenant/tenant-service';
import { TenantNotFoundError, TenantSuspendedError } from '@/lib/tenant/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  try {
    const tenant = await getTenantBySlug(slug);
    return {
      title: tenant.displayName,
      description: tenant.branding.tagline ?? `${tenant.displayName} on Vendorly`,
      icons: tenant.branding.faviconUrl ? { icon: tenant.branding.faviconUrl } : undefined,
    };
  } catch {
    return { title: 'Marketplace' };
  }
}

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (error) {
    if (error instanceof TenantNotFoundError || error instanceof TenantSuspendedError) {
      notFound();
    }
    throw error;
  }

  const activePos = tenant.posIntegrations.filter((integration) => integration.status === 'ACTIVE');

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 760 }}>
      {tenant.branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.branding.logoUrl} alt="" width={120} height={48} />
      ) : null}
      <h1 style={{ color: 'var(--tenant-primary)' }}>{tenant.displayName}</h1>
      {tenant.branding.tagline ? <p>{tenant.branding.tagline}</p> : null}
      <p>Tenant slug: <code>{tenant.slug}</code></p>
      {tenant.eventId ? (
        <p>
          Linked market event: <code>{tenant.eventId}</code>
        </p>
      ) : null}
      {activePos.length > 0 ? (
        <section>
          <h2>Active POS integrations</h2>
          <ul>
            {activePos.map((integration) => (
              <li key={integration.provider}>
                {integration.provider}
                {integration.providerAppId ? ` · app ${integration.providerAppId}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p>No active POS integrations configured for this tenant.</p>
      )}
    </main>
  );
}
