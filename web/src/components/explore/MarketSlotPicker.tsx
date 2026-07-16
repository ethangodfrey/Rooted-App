import { formatEventDisplayDate } from '@/lib/format';
import type { PresaleCartMarket } from '@/lib/presale-cart';

export interface MarketSlotPickerProps {
  markets: PresaleCartMarket[];
  selectedId: string | null;
  onSelect: (marketId: string) => void;
  now?: Date;
}

/**
 * Horizontal market-date slot chips for Explore Menu / pre-order flows.
 */
export function MarketSlotPicker({
  markets,
  selectedId,
  onSelect,
  now = new Date(),
}: MarketSlotPickerProps) {
  if (markets.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="m-0 text-[11px] font-bold tracking-[0.14em] text-white/45 uppercase">
        Pickup market date
      </p>
      <div
        className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Choose market pickup date"
      >
        {markets.map((market) => {
          const selected = market.id === selectedId;
          const dateLabel = formatEventDisplayDate(market, now);
          return (
            <button
              key={market.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(market.id)}
              className={`min-w-[9.5rem] shrink-0 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.98] ${
                selected
                  ? 'border-orange-500/60 bg-orange-500/20 shadow-lg shadow-orange-500/10'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]'
              }`}
            >
              <span
                className={`block text-[11px] font-extrabold tracking-wide ${
                  selected ? 'text-orange-400' : 'text-white/55'
                }`}
              >
                {dateLabel}
              </span>
              <span className="mt-1 block truncate text-sm font-bold text-white">
                {market.name}
              </span>
              {market.city ? (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-white/45">
                  {[market.city, market.state].filter(Boolean).join(', ')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
