import { formatUsdFromCents, type VendorBalance } from '@/lib/vendor-financials';

type WalletOverviewProps = {
  balance: VendorBalance | null;
  loading?: boolean;
};

/**
 * Wallet Overview — vendor_balances snapshot for Phase 4 financials.
 */
export function WalletOverview({ balance, loading }: WalletOverviewProps) {
  if (loading) {
    return (
      <p className="app-subtitle font-mono text-xs uppercase tracking-wide">
        LOADING_WALLET…
      </p>
    );
  }

  if (!balance) {
    return (
      <p className="app-subtitle">
        No wallet balance yet. Accepted catering deposits will appear here after
        escrow clearing.
      </p>
    );
  }

  const cards = [
    {
      label: 'Available',
      value: formatUsdFromCents(balance.AVAILABLE_CENTS),
      tone: 'text-emerald-300',
    },
    {
      label: 'Held in escrow',
      value: formatUsdFromCents(balance.ESCROW_HELD_CENTS),
      tone: 'text-amber-300',
    },
    {
      label: 'Loyalty liability',
      value: formatUsdFromCents(balance.LOYALTY_LIABILITY_CENTS),
      tone: 'text-sky-300',
    },
    {
      label: 'Micro fees',
      value: formatUsdFromCents(balance.MICRO_FEE_CENTS),
      tone: 'text-white/70',
    },
  ];

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/45">
        FINANCIAL_UI_ACTIVE · VENDOR_BALANCES
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-white/50">
              {card.label}
            </p>
            <p className={`m-0 mt-2 font-mono text-xl font-semibold ${card.tone}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
