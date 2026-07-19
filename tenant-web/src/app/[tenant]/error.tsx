'use client';

import { useEffect } from 'react';

import { TenantNotFoundFallback } from '@/components/tenant/TenantNotFoundFallback';

export default function TenantRouteError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Uppercase text-only tracing (no emoji).
    // eslint-disable-next-line no-console
    console.log(`FALLBACK_TRIGGERED REASON=ROUTE_ERROR DETAIL=${error.message}`);
    // eslint-disable-next-line no-console
    console.log('TENANT_NOT_FOUND');
  }, [error]);

  return (
    <TenantNotFoundFallback
      detail={error.digest ? `DIGEST_${error.digest}` : 'ROUTE_ERROR'}
    />
  );
}
