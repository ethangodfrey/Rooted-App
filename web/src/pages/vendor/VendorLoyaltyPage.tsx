import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  fetchVendorLoyaltyStatus,
  fundVendorBoostBalance,
  setVendorRewardsOptIn,
  toggleVendorBoost,
  type VendorLoyaltyStatus,
} from '@/lib/shopper-loyalty';
import '@/components/ui/ui.css';

export function VendorLoyaltyPage() {
  const { vendor } = useAuth();
  const [status, setStatus] = useState<VendorLoyaltyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    console.log('LOYALTY_UI_ACTIVE SURFACE=VENDOR_BOOSTS');
  }, []);

  const load = useCallback(async () => {
    if (!vendor?.id) {
      setLoading(false);
      return;
    }
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVendorLoyaltyStatus();
      setStatus(res);
      console.log(
        `REWARDS_SYNC_VERIFIED BOOSTS=${res.ACTIVE_BOOSTS?.length ?? 0}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load loyalty status');
    } finally {
      setLoading(false);
    }
  }, [vendor?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onOptIn(enabled: boolean) {
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      await setVendorRewardsOptIn(enabled);
      setFlash(enabled ? 'REWARDS PROGRAM ON' : 'REWARDS PROGRAM OFF');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opt-in failed');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleBoost(enabled: boolean) {
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      await toggleVendorBoost(enabled);
      setFlash(enabled ? 'DOUBLE POINTS ON' : 'DOUBLE POINTS OFF');
      console.log(`LOYALTY_UI_ACTIVE ACTION=BOOST_${enabled ? 'ON' : 'OFF'}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Boost toggle failed');
    } finally {
      setSaving(false);
    }
  }

  async function onFund() {
    setSaving(true);
    setError(null);
    try {
      await fundVendorBoostBalance(500);
      setFlash('FUNDED 500 CENTS BOOST BALANCE');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fund failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Phase 3 loyalty"
        title="Loyalty & Boosts"
        subtitle="Opt into Precision Rewards and sponsor Double Points windows for market events or catering."
        pill="LOYALTY_UI_ACTIVE"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/vendor/catering" className="app-btn app-btn--secondary app-btn--small">
          Catering settings
        </Link>
        <Link
          to="/vendor/availability"
          className="app-btn app-btn--secondary app-btn--small"
        >
          Availability
        </Link>
      </div>

      {error ? <FieldError message={error} /> : null}
      {flash ? (
        <p className="mb-4 font-mono text-xs uppercase tracking-wide text-emerald-300">
          {flash}
        </p>
      ) : null}

      {loading || !status ? (
        <p className="app-subtitle">Loading loyalty status…</p>
      ) : (
        <>
          <VendorSection title="Rewards program">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <input
                type="checkbox"
                checked={status.REWARDS_OPT_IN}
                disabled={saving}
                onChange={(e) => void onOptIn(e.target.checked)}
              />
              <span>
                Opt in so shoppers can redeem vouchers and early access at your booth
              </span>
            </label>
          </VendorSection>

          <VendorSection title="Double Points boost">
            <p className="app-subtitle mb-3">
              When active, shopper ticks on your items earn a 2x multiplier while your boost
              balance covers the micro-fee.
            </p>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-orange-300">
              Balance {status.BOOST_BALANCE_CENTS} cents ·{' '}
              {status.BOOST_ACTIVE ? 'BOOST ACTIVE' : 'BOOST OFF'}
            </p>
            <div className="flex flex-wrap gap-2">
              <VendorPrimaryButton
                type="button"
                disabled={saving}
                onClick={() => void onToggleBoost(!status.BOOST_ACTIVE)}
              >
                {status.BOOST_ACTIVE ? 'Deactivate boost' : 'Activate Double Points'}
              </VendorPrimaryButton>
              <VendorPrimaryButton
                type="button"
                disabled={saving}
                onClick={() => void onFund()}
              >
                Fund $5 boost balance
              </VendorPrimaryButton>
            </div>
            {status.ACTIVE_BOOSTS.length > 0 ? (
              <ul className="mt-4 m-0 list-none space-y-2 p-0">
                {status.ACTIVE_BOOSTS.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-white/70"
                  >
                    {b.label} · {b.multiplier}x · ends{' '}
                    {new Date(b.endsAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            ) : null}
          </VendorSection>
        </>
      )}
    </VendorScreen>
  );
}
