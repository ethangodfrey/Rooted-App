'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  BusinessConnectionRequestResponse,
  BusinessConnectionStatus,
  BusinessConnectionStatusResponse,
} from '@/lib/b2b/types';

export type BusinessConnectionPanelProps = {
  peerVendorId: string;
  peerVendorName?: string | null;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function bannerForStatus(status: BusinessConnectionStatus | null): string {
  if (status === 'PENDING') return 'PENDING_APPROVAL';
  if (status === 'ACCEPTED') return 'CONNECTED_WHOLESALER';
  if (status === 'DECLINED') return 'CONNECTION_DECLINED';
  return 'NO_RELATIONSHIP';
}

export function BusinessConnectionPanel({
  peerVendorId,
  peerVendorName,
  accessToken,
  apiBaseUrl = '',
}: BusinessConnectionPanelProps) {
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<BusinessConnectionStatus | null>(null);

  const loadStatus = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/vendors/connections/with/${encodeURIComponent(peerVendorId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        },
      );
      const body = (await res.json()) as BusinessConnectionStatusResponse;
      if (!res.ok) {
        throw new Error(body.error || `B2B_STATUS_HTTP_${res.status}`);
      }
      setStatus(body.CONNECTION?.STATUS ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'B2B_STATUS_LOAD_FAILED');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, peerVendorId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const requestConnection = useCallback(async () => {
    if (!accessToken) return;
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/vendors/connections/request`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ receiverVendorId: peerVendorId }),
      });
      const body = (await res.json()) as BusinessConnectionRequestResponse;
      if (!res.ok) {
        throw new Error(
          body.error || body.message || `B2B_REQUEST_HTTP_${res.status}`,
        );
      }
      setStatus(body.CONNECTION?.STATUS ?? 'PENDING');
      if (typeof console !== 'undefined') {
        console.log('B2B_CONNECTION_REQUESTED PEER=%s', peerVendorId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'B2B_REQUEST_FAILED');
    } finally {
      setRequesting(false);
    }
  }, [accessToken, apiBaseUrl, peerVendorId]);

  const banner = bannerForStatus(status);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
        Business Relationship
      </p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight">
        {peerVendorName?.trim() || 'Wholesale Partner'}
      </h2>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/45">
        PEER {peerVendorId}
      </p>

      <div
        className={`mt-4 rounded-xl px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] ${
          status === 'ACCEPTED'
            ? 'bg-emerald-500/15 text-emerald-300'
            : status === 'PENDING'
              ? 'bg-amber-500/15 text-amber-200'
              : status === 'DECLINED'
                ? 'bg-rose-500/15 text-rose-200'
                : 'bg-white/5 text-white/60'
        }`}
      >
        {loading ? 'LOADING_STATUS' : banner}
      </div>

      {error ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-rose-300">{error}</p>
      ) : null}

      {!accessToken ? (
        <p className="mt-4 text-sm text-amber-200/85">
          AUTHORIZATION_REQUIRED to request a business connection.
        </p>
      ) : null}

      {!loading && status == null && accessToken ? (
        <button
          type="button"
          disabled={requesting}
          onClick={() => void requestConnection()}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {requesting ? 'SENDING_REQUEST' : 'REQUEST BUSINESS CONNECTION'}
        </button>
      ) : null}

      {status === 'PENDING' ? (
        <p className="mt-4 text-sm text-white/60">
          Awaiting partner approval. Banner state: PENDING_APPROVAL.
        </p>
      ) : null}

      {status === 'ACCEPTED' ? (
        <p className="mt-4 text-sm text-white/60">
          Wholesale channel open. Banner state: CONNECTED_WHOLESALER.
        </p>
      ) : null}
    </section>
  );
}
