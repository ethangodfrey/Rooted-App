import { TenantNotFoundFallback } from '@/components/tenant/TenantNotFoundFallback';

export default function TenantNotFound() {
  // eslint-disable-next-line no-console
  console.log('FALLBACK_TRIGGERED REASON=NOT_FOUND_ROUTE');
  // eslint-disable-next-line no-console
  console.log('TENANT_NOT_FOUND');
  return <TenantNotFoundFallback detail="NOT_FOUND_ROUTE" />;
}
