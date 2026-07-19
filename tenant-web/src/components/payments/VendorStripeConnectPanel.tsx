'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchStripeConnectStatus,
  startStripeConnectOnboarding,
  type StripeConnectStatus,
} from '@/lib/payments/stripe-connect';

export type VendorStripeConnectPanelProps = {
  accessToken?: string | null;
  apiBaseUrl?: string;
  stripeReturn?: string | null;
};

/**
 * Stripe Connect Express onboarding for vendor payouts.
 * Telemetry: STRIPE_ACCOUNT_LINKED
 */
export function VendorStripeConnectPanel({
  accessToken,
  apiBaseUrl = '',
  stripeReturn = null,
}: VendorStripeConnectPanelProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchStripeConnectStatus({ accessToken, apiBaseUrl });
      setStatus(next);
      if (next.connected && next.chargesEnabled) {
        // eslint-disable-next-line no-console
        console.log(
          `STRIPE_ACCOUNT_LINKED VENDOR=${next.VENDOR_ID ?? 'UNKNOWN'} ACCOUNT=${next.accountId ?? 'NONE'}`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'STRIPE_CONNECT_STATUS_FAILED',
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (stripeReturn === 'return' || stripeReturn === 'refresh') {
      void load();
    }
  }, [stripeReturn, load]);

  async function handleConnect() {
    if (!accessToken) {
      setError('AUTHORIZATION_REQUIRED');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const result = await startStripeConnectOnboarding({
        accessToken,
        apiBaseUrl,
        returnUrl: `${origin}/vendor/settings/payments?stripe=return`,
        refreshUrl: `${origin}/vendor/settings/payments?stripe=refresh`,
      });
      // eslint-disable-next-line no-console
      console.log(
        `STRIPE_ACCOUNT_LINKED VENDOR=${result.VENDOR_ID ?? 'UNKNOWN'} ACCOUNT=${result.accountId}`,
      );
      window.location.assign(result.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.toUpperCase()
          : 'STRIPE_CONNECT_ONBOARD_FAILED',
      );
      setConnecting(false);
    }
  }

  const connected = Boolean(status?.connected && status.chargesEnabled);

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-10 font-sans text-zinc-50">
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400/90">
          Payouts
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Payment settings
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
          Link your Stripe Connect Express account to receive wholesale and
          marketplace payouts for this vendor profile.
        </p>
      </header>

      {!accessToken ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-amber-200/90">
          AUTHORIZATION_REQUIRED — pass a Supabase Bearer token via{' '}
          <code className="rounded bg-white/10 px-1">access_token</code>.
        </div>
      ) : null}

      {stripeReturn === 'return' ? (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-emerald-200">
          STRIPE_RETURN — Connect status refreshed
        </p>
      ) : null}
      {stripeReturn === 'refresh' ? (
        <p className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-orange-200">
          STRIPE_REFRESH — resume onboarding
        </p>
      ) : null}

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-white/50">
          LOADING_STRIPE_CONNECT
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs uppercase tracking-wide text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && accessToken ? (
        <div className="mt-6 border-t border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
            Stripe Connect
          </p>
          {connected ? (
            <div className="mt-4">
              <p className="font-mono text-sm font-semibold uppercase tracking-wide text-emerald-200">
                STRIPE_ACCOUNT_LINKED
              </p>
              <p className="mt-2 text-sm text-white/65">
                Charges and payouts are enabled for vendor{' '}
                <span className="font-mono text-white/85">
                  {status?.VENDOR_ID ?? 'UNKNOWN'}
                </span>
                .
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Account
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-white">
                    {status?.accountId ?? 'NONE'}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Payouts
                  </dt>
                  <dd className="mt-1 font-mono text-xs uppercase text-white">
                    {status?.payoutsEnabled ? 'ENABLED' : 'PENDING'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mt-4">
              <p className="font-mono text-sm font-semibold uppercase tracking-wide text-amber-200">
                STRIPE_ACCOUNT_PENDING
              </p>
              <p className="mt-2 text-sm text-white/65">
                Complete Stripe Express onboarding to link your merchant bank
                account to this vendorId.
              </p>
              <button
                type="button"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={connecting}
                onClick={() => void handleConnect()}
              >
                {connecting ? 'CONNECTING' : 'CONNECT STRIPE'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
