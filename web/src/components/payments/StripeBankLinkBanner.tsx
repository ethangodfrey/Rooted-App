type StripeBankLinkBannerProps = {
  payoutsEnabled: boolean;
  loading?: boolean;
  linking?: boolean;
  onLinkBank: () => void;
  surface: 'VENDOR_FINANCIALS' | 'FARMER_LOGISTICS';
};

/**
 * Bank-link CTA for vendor financials / farmer logistics.
 * stripe_account_id null → Link Bank Account banner
 * stripe_account_id present → Payouts Enabled badge
 */
export function StripeBankLinkBanner({
  payoutsEnabled,
  loading,
  linking,
  onLinkBank,
  surface,
}: StripeBankLinkBannerProps) {
  if (loading) {
    return (
      <p className="mb-4 font-mono text-[10px] uppercase tracking-wide text-white/45">
        STRIPE_ONBOARDING_ACTIVE · LOADING…
      </p>
    );
  }

  if (payoutsEnabled) {
    return (
      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3"
        role="status"
      >
        <span className="inline-flex items-center rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
          Payouts Enabled
        </span>
        <p className="m-0 font-mono text-[10px] uppercase tracking-wide text-emerald-100/70">
          STRIPE_ONBOARDING_ACTIVE · {surface}
        </p>
      </div>
    );
  }

  return (
    <aside
      className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4"
      aria-label="Link bank account"
    >
      <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
        BANK_LINK_INITIALIZED · {surface}
      </p>
      <p className="m-0 mt-2 text-base font-semibold tracking-tight text-amber-50">
        Link Bank Account to Receive Payouts
      </p>
      <p className="m-0 mt-1 max-w-xl text-sm leading-relaxed text-amber-100/75">
        Connect Stripe Express so escrow settlements can route to your bank.
        You can resume later if you leave the hosted onboarding flow.
      </p>
      <button
        type="button"
        className="app-btn app-btn--primary mt-4"
        disabled={linking}
        onClick={onLinkBank}
      >
        {linking ? 'Redirecting to Stripe…' : 'Link Bank Account'}
      </button>
    </aside>
  );
}
