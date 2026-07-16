import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  PREORDER_PAYMENT_POLICY_OPTIONS,
  fetchStripeConnectStatus,
  startStripeConnectOnboarding,
  type PreorderPaymentPolicy,
  type StripeConnectStatus,
} from '@/lib/stripe-connect';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const TACTILE =
  'inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

export function VendorPaymentsPage() {
  const { vendor, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const stripeReturn = searchParams.get('stripe');

  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [policy, setPolicy] = useState<PreorderPaymentPolicy>('pickup_or_stripe');
  const [acceptsSnap, setAcceptsSnap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor?.id) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: vendorError } = await supabase
        .from('vendors')
        .select('preorder_payment_policy, accepts_snap_ebt, stripe_charges_enabled, stripe_account_id')
        .eq('id', vendor.id)
        .maybeSingle();

      if (vendorError) throw new Error(vendorError.message);

      const nextPolicy = (data?.preorder_payment_policy as PreorderPaymentPolicy | null) ?? 'pickup_or_stripe';
      setPolicy(
        nextPolicy === 'pickup_only' || nextPolicy === 'stripe_only' || nextPolicy === 'pickup_or_stripe'
          ? nextPolicy
          : 'pickup_or_stripe',
      );
      setAcceptsSnap(Boolean(data?.accepts_snap_ebt));

      if (isApiConfigured) {
        const connect = await fetchStripeConnectStatus();
        setStatus(connect);
      } else {
        setStatus({
          connected: Boolean(data?.stripe_account_id && data?.stripe_charges_enabled),
          accountId: (data?.stripe_account_id as string | null) ?? null,
          chargesEnabled: Boolean(data?.stripe_charges_enabled),
          payoutsEnabled: false,
          marketplacePayoutsEnabled: false,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment settings');
    } finally {
      setLoading(false);
    }
  }, [vendor?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (stripeReturn === 'return' || stripeReturn === 'refresh') {
      void load();
      void refreshUser();
    }
  }, [stripeReturn, load, refreshUser]);

  async function handleConnect() {
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL to enable Stripe Connect.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const result = await startStripeConnectOnboarding({
        returnUrl: `${origin}/vendor/settings/payments?stripe=return`,
        refreshUrl: `${origin}/vendor/settings/payments?stripe=refresh`,
      });
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Stripe onboarding');
      setConnecting(false);
    }
  }

  async function handleSavePolicy() {
    if (!vendor?.id) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    const { error: upError } = await supabase
      .from('vendors')
      .update({
        preorder_payment_policy: policy,
        accepts_snap_ebt: acceptsSnap,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendor.id);
    setSaving(false);
    if (upError) {
      setError(upError.message);
      return;
    }
    setSaveMessage('Payment preferences saved.');
    void refreshUser();
  }

  const connected = Boolean(status?.connected && status.chargesEnabled);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  return (
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Dashboard
      </Link>
      <VendorHero
        eyebrow="Payouts"
        title="Payment settings"
        subtitle="Connect Stripe for card pre-orders and choose how shoppers pay before market day."
        pill={connected ? 'Stripe connected' : 'Setup needed'}
      />

      {stripeReturn === 'return' ? (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          Welcome back from Stripe — we refreshed your Connect status.
        </p>
      ) : null}
      {stripeReturn === 'refresh' ? (
        <p className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200">
          Stripe link expired — tap Connect again to resume onboarding.
        </p>
      ) : null}
      {error ? <p className="app-error mb-4">{error}</p> : null}
      {saveMessage ? (
        <p className="mb-4 text-sm font-semibold text-orange-400" role="status">
          {saveMessage}
        </p>
      ) : null}

      <VendorSection title="Stripe Connect">
        <VendorFormPanel className="!bg-[#121A36] !text-zinc-50">
          {connected ? (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-4">
              <p className="m-0 text-sm font-extrabold tracking-wide text-emerald-300">
                Stripe Account Connected
              </p>
              <p className="m-0 mt-1 text-sm text-emerald-100/80">
                Charges and payouts are enabled. Online pre-order payments can route to your Connect
                account.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                    Charges
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-white">
                    {status?.chargesEnabled ? 'Enabled' : 'Pending'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                    Payouts
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-white">
                    {status?.payoutsEnabled ? 'Enabled' : 'Pending'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                    Payment statistics
                  </dt>
                  <dd className="m-0 mt-1 font-medium text-white/70">
                    Settlement charts appear on Analytics once online orders start flowing.
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div>
              <p className="m-0 text-sm font-medium leading-relaxed text-white/70">
                Connect an Express account to accept card payments for pre-orders. You can still take
                pay-at-pickup reservations without Stripe.
              </p>
              <button
                type="button"
                className={`${TACTILE} mt-4`}
                disabled={connecting}
                onClick={() => void handleConnect()}
              >
                {connecting ? 'Redirecting to Stripe…' : 'Connect with Stripe'}
              </button>
            </div>
          )}
        </VendorFormPanel>
      </VendorSection>

      <VendorSection title="Pre-order payment configuration">
        <VendorFormPanel className="!bg-[#121A36] !text-zinc-50">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-widest text-orange-400">
              Checkout policy
            </legend>
            <div className="flex flex-col gap-2">
              {PREORDER_PAYMENT_POLICY_OPTIONS.map((option) => {
                const selected = policy === option.value;
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                      selected
                        ? 'border-orange-500/55 bg-orange-500/15'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="preorder_payment_policy"
                        className="mt-1 accent-orange-500"
                        checked={selected}
                        onChange={() => setPolicy(option.value)}
                      />
                      <span>
                        <span className="block text-sm font-bold text-white">{option.label}</span>
                        <span className="mt-0.5 block text-xs font-medium text-white/55">
                          {option.description}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {policy !== 'pickup_only' && !connected ? (
            <p className="mt-3 text-xs font-semibold text-orange-300">
              Connect Stripe before shoppers can pay online. Until then, cart will fall back to
              pickup when possible.
            </p>
          ) : null}

          <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3">
            <span>
              <span className="block text-sm font-bold text-emerald-300">Accepts SNAP / EBT</span>
              <span className="mt-0.5 block text-xs font-medium text-emerald-200/70">
                Show your booth in SNAP discovery filters. EBT still runs on your terminal.
              </span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-500"
              checked={acceptsSnap}
              onChange={(e) => setAcceptsSnap(e.target.checked)}
            />
          </label>

          <VendorPrimaryButton className="mt-5" disabled={saving} onClick={() => void handleSavePolicy()}>
            {saving ? 'Saving…' : 'Save payment preferences'}
          </VendorPrimaryButton>
        </VendorFormPanel>
      </VendorSection>
    </VendorScreen>
  );
}
