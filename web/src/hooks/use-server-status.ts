import { useCallback, useEffect, useState } from 'react';

import { resolveApiBaseUrl, isApiUrlConfigured } from '@/lib/api-url';

export type ServerConnectionStatus = 'unknown' | 'checking' | 'online' | 'offline';

export interface ServerStatusSnapshot {
  status: ServerConnectionStatus;
  apiUrl: string;
  latencyMs: number | null;
  message: string | null;
  checkedAt: string | null;
}

export function useServerStatus(pollMs = 30_000): ServerStatusSnapshot {
  const [snapshot, setSnapshot] = useState<ServerStatusSnapshot>({
    status: 'unknown',
    apiUrl: '',
    latencyMs: null,
    message: null,
    checkedAt: null,
  });

  const check = useCallback(async () => {
    if (!isApiUrlConfigured()) {
      setSnapshot({
        status: 'unknown',
        apiUrl: '',
        latencyMs: null,
        message: 'Backend URL not configured',
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    const apiUrl = resolveApiBaseUrl();
    setSnapshot((prev) => ({ ...prev, status: 'checking', apiUrl }));

    const started = performance.now();
    try {
      const res = await fetch(`${apiUrl}/health/live`, {
        method: 'GET',
        cache: 'no-store',
      });
      const latencyMs = Math.round(performance.now() - started);

      if (!res.ok) {
        setSnapshot({
          status: 'offline',
          apiUrl,
          latencyMs,
          message: `API returned ${res.status}`,
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      setSnapshot({
        status: 'online',
        apiUrl,
        latencyMs,
        message: null,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      setSnapshot({
        status: 'offline',
        apiUrl,
        latencyMs: null,
        message: `Cannot reach ${apiUrl}. Start backend (cd backend && npm run start:dev) and allow port 4000 on Windows Firewall.`,
        checkedAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    const startDelay = window.setTimeout(() => void check(), 2000);
    const id = window.setInterval(() => void check(), pollMs);
    return () => {
      window.clearTimeout(startDelay);
      window.clearInterval(id);
    };
  }, [check, pollMs]);

  return snapshot;
}
