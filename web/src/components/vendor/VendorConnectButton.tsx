import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import {
  acceptV2vConnection,
  findPairView,
  ignoreV2vConnection,
  listV2vConnections,
  requestV2vConnection,
  type V2vUiState,
} from '@/lib/v2v-connections';

type VendorConnectButtonProps = {
  peerVendorId: string;
  className?: string;
  onUiChange?: (ui: V2vUiState) => void;
};

const BTN =
  'inline-flex items-center justify-center rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-55';

/**
 * Phase 83b — send / accept V2V connection requests via `/api/v2v/connections`.
 */
export function VendorConnectButton({
  peerVendorId,
  className,
  onUiChange,
}: VendorConnectButtonProps) {
  const { vendor } = useAuth();
  const vendorId = vendor?.id ?? null;
  const [ui, setUi] = useState<V2vUiState>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyUi = useCallback(
    (next: V2vUiState, id: string | null) => {
      setUi(next);
      setConnectionId(id);
      onUiChange?.(next);
    },
    [onUiChange],
  );

  useEffect(() => {
    let active = true;
    if (!vendorId || !peerVendorId || vendorId === peerVendorId) return;

    void listV2vConnections()
      .then((rows) => {
        if (!active) return;
        const view = findPairView(rows, vendorId, peerVendorId);
        applyUi(view.uiState, view.row?.id ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'V2V_NETWORK_ERROR');
      });

    return () => {
      active = false;
    };
  }, [vendorId, peerVendorId, applyUi]);

  if (!vendorId || vendorId === peerVendorId) return null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'V2V_NETWORK_ERROR');
    } finally {
      setBusy(false);
    }
  }

  if (ui === 'connected') {
    return (
      <span
        className={`${BTN} border-emerald-500/50 bg-emerald-500/10 text-emerald-300 ${className ?? ''}`}
      >
        Connected
      </span>
    );
  }

  if (ui === 'pending_sent') {
    return (
      <span
        className={`${BTN} border-amber-500/40 bg-amber-500/10 text-amber-200 ${className ?? ''}`}
      >
        Request sent
      </span>
    );
  }

  if (ui === 'pending_received' && connectionId) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
        <button
          type="button"
          disabled={busy}
          className={`${BTN} border-orange-500/55 bg-orange-600 text-white`}
          onClick={() =>
            void run(async () => {
              const row = await acceptV2vConnection(connectionId);
              applyUi('connected', row.id);
            })
          }
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          className={`${BTN} border-white/20 bg-transparent text-white/70`}
          onClick={() =>
            void run(async () => {
              const row = await ignoreV2vConnection(connectionId);
              applyUi('ignored', row.id);
            })
          }
        >
          Ignore
        </button>
        {error ? <span className="text-[10px] text-rose-400">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className ?? ''}`}>
      <button
        type="button"
        disabled={busy}
        className={`${BTN} border-orange-500/55 bg-orange-600 text-white hover:bg-orange-500`}
        onClick={() =>
          void run(async () => {
            const row = await requestV2vConnection(peerVendorId);
            applyUi('pending_sent', row.id);
          })
        }
      >
        {busy ? 'Sending…' : 'Connect'}
      </button>
      {error ? <span className="text-[10px] text-rose-400">{error}</span> : null}
    </div>
  );
}
