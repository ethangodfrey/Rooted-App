'use client';

import { useBusinessConnection } from '@/lib/b2b/use-business-connection';
import type { ConnectionUiPhase } from '@/lib/b2b/use-business-connection';

export type BusinessConnectionPanelProps = {
  peerVendorId: string;
  peerVendorName?: string | null;
  accessToken?: string | null;
  apiBaseUrl?: string;
};

function bannerClass(phase: ConnectionUiPhase): string {
  switch (phase) {
    case 'CONNECTED_WHOLESALER':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'PENDING_APPROVAL':
    case 'INITIATING':
      return 'bg-amber-500/15 text-amber-200';
    case 'CONNECTION_DECLINED':
    case 'ERROR':
      return 'bg-rose-500/15 text-rose-200';
    case 'UNAUTHORIZED':
      return 'bg-amber-500/10 text-amber-100/90';
    default:
      return 'bg-white/5 text-white/60';
  }
}

function bannerLabel(phase: ConnectionUiPhase): string {
  switch (phase) {
    case 'LOADING':
      return 'LOADING_STATUS';
    case 'INITIATING':
      return 'CONNECTION_REQUEST_INITIATED';
    case 'PENDING_APPROVAL':
      return 'PENDING_APPROVAL';
    case 'CONNECTED_WHOLESALER':
      return 'CONNECTED_WHOLESALER';
    case 'CONNECTION_DECLINED':
      return 'CONNECTION_DECLINED';
    case 'UNAUTHORIZED':
      return 'AUTHORIZATION_REQUIRED';
    case 'ERROR':
      return 'CONNECTION_STATUS_ERROR';
    case 'READY':
    default:
      return 'NO_RELATIONSHIP';
  }
}

function buttonLabel(phase: ConnectionUiPhase): string {
  if (phase === 'INITIATING') return 'CONNECTION_REQUEST_INITIATED';
  if (phase === 'CONNECTION_DECLINED') return 'REQUEST BUSINESS CONNECTION';
  return 'REQUEST BUSINESS CONNECTION';
}

export function BusinessConnectionPanel({
  peerVendorId,
  peerVendorName,
  accessToken,
  apiBaseUrl = '',
}: BusinessConnectionPanelProps) {
  const {
    phase,
    error,
    canRequest,
    requestConnection,
  } = useBusinessConnection({
    peerVendorId,
    accessToken,
    apiBaseUrl,
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
        Business Relationship
      </p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-zinc-50">
        {peerVendorName?.trim() || 'Wholesale Partner'}
      </h2>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/45">
        PEER {peerVendorId}
      </p>

      <div
        className={`mt-4 rounded-xl px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] ${bannerClass(phase)}`}
        data-connection-phase={phase}
      >
        {bannerLabel(phase)}
      </div>

      {error ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-rose-300">
          {error}
        </p>
      ) : null}

      {phase === 'UNAUTHORIZED' ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-wide text-amber-200/85">
          AUTHORIZATION_REQUIRED to request a business connection.
        </p>
      ) : null}

      {canRequest ? (
        <button
          type="button"
          disabled={phase === 'INITIATING'}
          onClick={() => void requestConnection()}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-55"
          data-testid="request-business-connection"
        >
          {buttonLabel(phase)}
        </button>
      ) : null}

      {phase === 'INITIATING' ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-wide text-amber-200/80">
          CONNECTION_REQUEST_INITIATED forwarding through same-origin proxy.
        </p>
      ) : null}

      {phase === 'PENDING_APPROVAL' ? (
        <p className="mt-4 text-sm text-white/60">
          Awaiting partner approval. Visual state: PENDING_APPROVAL.
        </p>
      ) : null}

      {phase === 'CONNECTED_WHOLESALER' ? (
        <p className="mt-4 text-sm text-white/60">
          Wholesale channel open. Visual state: CONNECTED_WHOLESALER.
        </p>
      ) : null}

      {phase === 'CONNECTION_DECLINED' ? (
        <p className="mt-4 text-sm text-white/60">
          Prior request declined. You may submit a new business connection request.
        </p>
      ) : null}
    </section>
  );
}
