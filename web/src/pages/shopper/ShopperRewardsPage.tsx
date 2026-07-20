import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import { isApiConfigured } from '@/lib/api';
import {
  fetchActiveBoosts,
  fetchLoyaltyBalance,
  type ActiveBoostItem,
  type LoyaltyBalance,
} from '@/lib/shopper-loyalty';
import '@/components/ui/ui.css';

export function ShopperRewardsPage() {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [boosts, setBoosts] = useState<ActiveBoostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('LOYALTY_UI_ACTIVE SURFACE=SHOPPER_REWARDS');
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isApiConfigured) {
        setError('Backend API is not configured. Set VITE_API_URL.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [bal, boostRes] = await Promise.all([
          fetchLoyaltyBalance(),
          fetchActiveBoosts(40),
        ]);
        if (!active) return;
        setBalance(bal);
        setBoosts(boostRes.ITEMS ?? []);
        console.log(`LOYALTY_UI_ACTIVE POINTS=${bal.POINTS_TOTAL ?? 0}`);
        console.log(`REWARDS_SYNC_VERIFIED BOOSTS=${boostRes.COUNT ?? 0}`);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load rewards');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const points = balance?.POINTS_TOTAL ?? 0;
  const progressPct = Math.round((balance?.PROGRESS_RATIO ?? 0) * 100);
  const nextLabel = balance?.NEXT_LABEL;
  const nextPoints = balance?.NEXT_POINTS;

  return (
    <div className="app-screen app-screen--narrow app-screen--titled">
      <Link to="/shopper/profile" className="app-back-link">
        Profile
      </Link>
      <h1 className="app-title">Rewards</h1>
      <p className="app-subtitle">
        Earn points for RSVPs, catering inquiries, and collaboration purchases. Redeem at
        opted-in vendors.
      </p>

      {error ? <FieldError message={error} /> : null}

      {loading ? (
        <p className="app-subtitle">Loading rewards…</p>
      ) : (
        <>
          <section className="mb-6 rounded-xl border border-orange-500/30 bg-[radial-gradient(ellipse_80%_70%_at_0%_0%,rgba(249,115,22,0.22),transparent_55%),#121a36] p-5">
            <p className="m-0 font-mono text-[11px] uppercase tracking-widest text-orange-300">
              LOYALTY_UI_ACTIVE
            </p>
            <p className="m-0 mt-2 text-4xl font-extrabold text-zinc-50">{points}</p>
            <p className="m-0 mt-1 text-sm text-white/70">points total</p>

            <div className="mt-4">
              <div className="mb-1 flex justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-white/60">
                <span>
                  {nextPoints != null
                    ? `Next: ${nextLabel ?? 'tier'} (${nextPoints})`
                    : nextLabel ?? 'All tiers unlocked'}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-orange-400 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <ul className="mt-4 m-0 list-none space-y-1 p-0 font-mono text-[11px] uppercase tracking-wide text-white/65">
              <li>500 points = $5 vendor voucher</li>
              <li>1000 points = early access catering slots</li>
            </ul>
          </section>

          <section className="mb-6">
            <p className="app-eyebrow">Point breakdown</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['RSVP', balance?.RSVP_POINTS ?? 0],
                ['Catering', balance?.CATERING_POINTS ?? 0],
                ['Collab', balance?.COLLABORATION_POINTS ?? 0],
                ['Boosted', balance?.BOOSTED_POINTS ?? 0],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <p className="m-0 text-[11px] uppercase tracking-wide text-white/50">
                    {label}
                  </p>
                  <p className="m-0 text-lg font-bold text-zinc-50">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-6">
            <p className="app-eyebrow">Double Points vendors</p>
            {boosts.length === 0 ? (
              <p className="app-subtitle mt-2">
                No active Double Points boosts right now. Check back when vendors sponsor
                boost windows.
              </p>
            ) : (
              <ul className="mt-2 m-0 flex list-none flex-col gap-2 p-0">
                {boosts.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="m-0 font-semibold text-zinc-50">
                          {b.vendorName ?? 'Vendor'}
                        </p>
                        <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-wide text-orange-300/90">
                          {b.label} · {b.multiplier}x
                        </p>
                      </div>
                      <Link
                        to={`/shopper/vendors/${b.vendorId}`}
                        className="app-btn app-btn--small app-btn--secondary"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
