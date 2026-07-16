import { allocateHybridStock, formatHybridStockLabel } from '@/lib/hybrid-stock';

export interface HybridStockAllocatorProps {
  totalStock: number;
  /** 0–100 share allocated to online pre-orders */
  preOrderPercent: number;
  onPreOrderPercentChange: (percent: number) => void;
  disabled?: boolean;
  id?: string;
}

/**
 * Dual-allocation control: drag to balance Online Pre-Orders vs In-Person Walk-Ups.
 */
export function HybridStockAllocator({
  totalStock,
  preOrderPercent,
  onPreOrderPercentChange,
  disabled = false,
  id = 'hybrid-stock-slider',
}: HybridStockAllocatorProps) {
  const split = allocateHybridStock(totalStock, preOrderPercent);
  const pct = split.preOrderPercent;

  return (
    <div className="hybrid-allocator">
      <div className="hybrid-allocator__labels">
        <span>Online Pre-Orders</span>
        <span>In-Person Walk-Ups</span>
      </div>

      <label className="sr-only" htmlFor={id}>
        Allocate batch between online pre-orders and in-person walk-ups
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={formatHybridStockLabel(split)}
        className="hybrid-slider"
        style={{ ['--hybrid-pct' as string]: `${pct}%` }}
        onChange={(e) => onPreOrderPercentChange(Number.parseInt(e.target.value, 10))}
      />

      <div className="hybrid-allocator__pct-row">
        <span>{pct}% pre-order</span>
        <span>{100 - pct}% walk-up</span>
      </div>

      <p className="hybrid-allocator__result" aria-live="polite">
        {formatHybridStockLabel(split)}
      </p>
    </div>
  );
}
