import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getMarketDirectoryBySlug } from '@/lib/markets/directory';
import {
  resolveMarketBannerText,
  resolveMarketLocationLine,
} from '@/lib/markets/directory';
import { getTenantBySlug } from '@/lib/tenant/tenant-service';
import { TenantNotFoundError, TenantSuspendedError } from '@/lib/tenant/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  try {
    const [tenant, market] = await Promise.all([
      getTenantBySlug(slug),
      getMarketDirectoryBySlug(slug),
    ]);
    const title = market?.name ?? tenant.displayName;
    const description =
      (market ? resolveMarketBannerText(market) : null) ??
      tenant.branding.tagline ??
      `${title} on Vendorly`;
    return {
      title,
      description,
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

  const market = await getMarketDirectoryBySlug(slug);
  const title = market?.name ?? tenant.displayName;
  const bannerText =
    (market ? resolveMarketBannerText(market) : null) ?? tenant.branding.tagline;
  const locationLine = market ? resolveMarketLocationLine(market) : null;
  const activePos = tenant.posIntegrations.filter((integration) => integration.status === 'ACTIVE');

  return (
    <main style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '2rem', maxWidth: 760 }}>
      {tenant.branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.branding.logoUrl} alt="" width={120} height={48} />
      ) : null}
      <h1 style={{ color: 'var(--tenant-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </h1>
      {bannerText ? (
        <p
          style={{
            borderLeft: '3px solid var(--tenant-accent)',
            paddingLeft: '0.75rem',
            color: 'var(--market-title-color, var(--tenant-primary))',
          }}
        >
          {bannerText}
        </p>
      ) : null}
      {locationLine ? <p>LOCATION {locationLine}</p> : null}
      {market?.operatingHours ? <p>HOURS {market.operatingHours}</p> : null}
      <p>
        TENANT <code>{tenant.slug}</code>
        {market?.directorySlug ? (
          <>
            {' '}
            DIRECTORY <code>{market.directorySlug}</code>
          </>
        ) : null}
      </p>
      {tenant.eventId ? (
        <p>
          LINKED_EVENT <code>{tenant.eventId}</code>
        </p>
      ) : null}
      {activePos.length > 0 ? (
        <section>
          <h2 style={{ color: 'var(--tenant-accent)' }}>ACTIVE POS</h2>
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
        <p>NO_ACTIVE_POS</p>
      )}
    </main>
  );
}
