import { useCallback, useEffect, useState } from 'react';

import {
  fetchCustomerThreads,
  fetchVendorThreads,
  subscribeToInboxMessages,
  type InboxThread,
} from '@/lib/messaging';

export function useCustomerMessageInbox(customerUserId: string | null | undefined) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(Boolean(customerUserId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!customerUserId) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setThreads(await fetchCustomerThreads(customerUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages');
    } finally {
      setLoading(false);
    }
  }, [customerUserId]);

  useEffect(() => {
    setLoading(Boolean(customerUserId));
    void refresh();
  }, [customerUserId, refresh]);

  useEffect(() => {
    if (!customerUserId) return;
    return subscribeToInboxMessages(() => {
      void refresh();
    });
  }, [customerUserId, refresh]);

  return { threads, loading, error, refresh };
}

export function useVendorMessageInbox(vendorId: string | null | undefined) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(Boolean(vendorId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!vendorId) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setThreads(await fetchVendorThreads(vendorId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    setLoading(Boolean(vendorId));
    void refresh();
  }, [vendorId, refresh]);

  useEffect(() => {
    if (!vendorId) return;
    return subscribeToInboxMessages(() => {
      void refresh();
    });
  }, [vendorId, refresh]);

  return { threads, loading, error, refresh };
}
