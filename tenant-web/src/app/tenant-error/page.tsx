import { TenantNotFoundFallback } from '@/components/tenant/TenantNotFoundFallback';

const REASON_DETAIL: Record<string, string> = {
  not_found: 'UNSEEDED_OR_UNKNOWN_HOST',
  suspended: 'TENANT_SUSPENDED',
  missing_host: 'MISSING_HOST',
  resolve_failed: 'RESOLVE_FAILED',
  invalid_slug: 'INVALID_SLUG',
};

export default async function TenantErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; host?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? 'resolve_failed';
  const host = params.host ?? '';
  const detail = REASON_DETAIL[reason] ?? REASON_DETAIL.resolve_failed;

  // eslint-disable-next-line no-console
  console.log(`FALLBACK_TRIGGERED REASON=${reason.toUpperCase()} HOST=${host || 'NONE'}`);
  // eslint-disable-next-line no-console
  console.log('TENANT_NOT_FOUND');

  return <TenantNotFoundFallback host={host || null} detail={detail} />;
}
