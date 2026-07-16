import { useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, Store } from 'lucide-react';

import { startSquareOAuth, tenantWebBaseUrl } from '@/lib/square-auth-connect';
import type { VendorPosConnectionPublic } from '@/types/pos-transactions';
import '@/components/ui/ui.css';

export interface SquarePosConnectionCardProps {
  vendorId: string | undefined;
  connections: VendorPosConnectionPublic[];
  loading?: boolean;
}

function isActiveSquare(connection: VendorPosConnectionPublic): boolean {
  return (
    connection.provider === 'square' &&
    (connection.status === 'active' || connection.status === 'ACTIVE')
  );
}

export function SquarePosConnectionCard({
  vendorId,
  connections,
  loading = false,
}: SquarePosConnectionCardProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const square = connections.find(isActiveSquare) ?? null;
  const connected = Boolean(square);
  const merchantName =
    square?.merchant_display_name?.trim() ||
    square?.provider_merchant_id?.trim() ||
    'Square merchant';
  const tenantReady = Boolean(tenantWebBaseUrl());

  async function onConnect() {
    if (!vendorId) return;
    setConnecting(true);
    setError(null);
    try {
      await startSquareOAuth(vendorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Square OAuth');
      setConnecting(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-zinc-200/50 bg-white p-4"
      aria-label="Square Point of Sale connection"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200/50 ${
            connected ? 'bg-emerald-500/10 text-emerald-700' : 'bg-zinc-50 text-zinc-600'
          }`}
        >
          <Store className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-semibold text-zinc-900">Point of Sale</h3>
            {loading ? (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-200/50 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Checking
              </span>
            ) : connected ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-200/50 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Disconnected
              </span>
            )}
          </div>

          {connected ? (
            <p className="m-0 mt-1.5 text-xs leading-snug text-stone-600">
              Linked to <span className="font-semibold text-stone-800">{merchantName}</span>
            </p>
          ) : (
            <p className="m-0 mt-1.5 text-xs leading-snug text-stone-600">
              Connect Square to sync live sales into your Vendorly dashboard.
            </p>
          )}

          {error ? <p className="app-error mt-2 mb-0">{error}</p> : null}

          {!connected && !loading ? (
            <button
              type="button"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={!vendorId || connecting || !tenantReady}
              onClick={() => void onConnect()}
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <PlugZap className="h-4 w-4" aria-hidden />
              )}
              {connecting ? 'Redirecting to Square…' : 'Connect your Square Account'}
            </button>
          ) : null}

          {!tenantReady && !connected ? (
            <p className="m-0 mt-2 text-[11px] text-stone-500">
              Tenant gateway URL is not configured (`VITE_TENANT_WEB_URL`).
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
