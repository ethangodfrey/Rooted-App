'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  SupplierArMetrics,
  SupplierArMetricsResponse,
} from '@/lib/b2b/types';

export type UseSupplierARMetricsOptions = {
  accessToken?: string | null;
  apiBaseUrl?: string;
};

const EMPTY_METRICS: SupplierArMetrics = {
  TOTAL_REVENUE_CENTS: 0,
  OUTSTANDING_CAPITAL_CENTS: 0,
  AT_RISK_CAPITAL_CENTS: 0,
};

/**
 * Secure seller-scoped A/R aggregation for the wholesale dashboard.
 * Filters wholesale_invoices by authenticated seller_vendor_id on the API.
 */
export function useSupplierARMetrics(
  options: UseSupplierARMetricsOptions = {},
) {
  const { accessToken = null, apiBaseUrl = '' } = options;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerVendorId, setSellerVendorId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SupplierArMetrics>(EMPTY_METRICS);
  const [counts, setCounts] = useState({ PAID: 0, PENDING: 0, OVERDUE: 0 });

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setMetrics(EMPTY_METRICS);
      setSellerVendorId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/vendors/invoices/ar-metrics`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const body = (await res.json()) as SupplierArMetricsResponse;
      if (!res.ok) {
        throw new Error(body.error || body.message || `AR_METRICS_HTTP_${res.status}`);
      }

      const next: SupplierArMetrics = {
        TOTAL_REVENUE_CENTS: Number(
          body.METRICS?.TOTAL_REVENUE_CENTS ?? body.TOTAL_REVENUE_CENTS ?? 0,
        ),
        OUTSTANDING_CAPITAL_CENTS: Number(
          body.METRICS?.OUTSTANDING_CAPITAL_CENTS ??
            body.OUTSTANDING_CAPITAL_CENTS ??
            0,
        ),
        AT_RISK_CAPITAL_CENTS: Number(
          body.METRICS?.AT_RISK_CAPITAL_CENTS ?? body.AT_RISK_CAPITAL_CENTS ?? 0,
        ),
      };
      setMetrics(next);
      setSellerVendorId(body.SESSION_VENDOR_ID ?? null);
      setCounts({
        PAID: Number(body.COUNTS?.PAID ?? 0),
        PENDING: Number(body.COUNTS?.PENDING ?? 0),
        OVERDUE: Number(body.COUNTS?.OVERDUE ?? 0),
      });
      // eslint-disable-next-line no-console
      console.log(
        `METRICS_AGGREGATION_SUCCESS SELLER=${body.SESSION_VENDOR_ID ?? 'UNKNOWN'} REVENUE_CENTS=${next.TOTAL_REVENUE_CENTS} OUTSTANDING_CENTS=${next.OUTSTANDING_CAPITAL_CENTS} AT_RISK_CENTS=${next.AT_RISK_CAPITAL_CENTS}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'AR_METRICS_LOAD_FAILED',
      );
      setMetrics(EMPTY_METRICS);
      setCounts({ PAID: 0, PENDING: 0, OVERDUE: 0 });
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      loading,
      error,
      sellerVendorId,
      metrics,
      counts,
      reload: load,
    }),
    [counts, error, load, loading, metrics, sellerVendorId],
  );
}
