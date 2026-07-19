'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  BusinessConnectionRequestResponse,
  BusinessConnectionStatus,
  BusinessConnectionStatusResponse,
} from './types';

export type ConnectionUiPhase =
  | 'LOADING'
  | 'UNAUTHORIZED'
  | 'READY'
  | 'INITIATING'
  | 'PENDING_APPROVAL'
  | 'CONNECTED_WHOLESALER'
  | 'CONNECTION_DECLINED'
  | 'ERROR';

export type UseBusinessConnectionArgs = {
  peerVendorId: string;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function phaseFromStatus(
  status: BusinessConnectionStatus | null,
  loading: boolean,
  initiating: boolean,
  hasToken: boolean,
  hasError: boolean,
): ConnectionUiPhase {
  if (!hasToken) return 'UNAUTHORIZED';
  if (initiating) return 'INITIATING';
  if (loading) return 'LOADING';
  if (hasError && status == null) return 'ERROR';
  if (status === 'PENDING') return 'PENDING_APPROVAL';
  if (status === 'ACCEPTED') return 'CONNECTED_WHOLESALER';
  if (status === 'DECLINED') return 'CONNECTION_DECLINED';
  return 'READY';
}

export function useBusinessConnection({
  peerVendorId,
  accessToken,
  apiBaseUrl = '',
}: UseBusinessConnectionArgs) {
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
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
    setInitiating(true);
    setError(null);
    // eslint-disable-next-line no-console
    console.log(
      `CONNECTION_REQUEST_INITIATED PEER=${peerVendorId} TARGET=/api/vendors/connections`,
    );
    try {
      const res = await fetch(`${apiBaseUrl}/api/vendors/connections`, {
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
      const nextStatus = body.CONNECTION?.STATUS ?? 'PENDING';
      setStatus(nextStatus);
      // eslint-disable-next-line no-console
      console.log(
        `PROXY_HANDSHAKE_SUCCESS PEER=${peerVendorId} STATUS=${nextStatus}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'B2B_REQUEST_FAILED';
      setError(message);
      // eslint-disable-next-line no-console
      console.log(`PROXY_HANDSHAKE_FAILED PEER=${peerVendorId} DETAIL=${message}`);
    } finally {
      setInitiating(false);
    }
  }, [accessToken, apiBaseUrl, peerVendorId]);

  const phase = useMemo(
    () =>
      phaseFromStatus(
        status,
        loading,
        initiating,
        Boolean(accessToken),
        Boolean(error),
      ),
    [accessToken, error, initiating, loading, status],
  );

  const canRequest =
    Boolean(accessToken) &&
    !loading &&
    !initiating &&
    (status == null || status === 'DECLINED');

  return {
    phase,
    status,
    error,
    loading,
    initiating,
    canRequest,
    requestConnection,
    reload: loadStatus,
  };
}
