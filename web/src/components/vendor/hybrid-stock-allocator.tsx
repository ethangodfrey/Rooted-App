import {
  allocateHybridStock,
  formatHybridStockLabel,
  formatHybridStockPercentLabel,
} from '@/lib/hybrid-stock';

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
        <span>Digital Pre-Order</span>
        <span>In-Person Walk-Up</span>
      </div>

      <label className="sr-only" htmlFor={id}>
        Allocate batch between digital pre-orders and in-person walk-ups
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
        aria-valuetext={formatHybridStockPercentLabel(split)}
        className="hybrid-slider"
        style={{ ['--hybrid-pct' as string]: `${pct}%` }}
        onChange={(e) => onPreOrderPercentChange(Number.parseInt(e.target.value, 10))}
      />

      <p className="hybrid-allocator__result" aria-live="polite">
        {formatHybridStockPercentLabel(split)}
      </p>

      <div className="hybrid-allocator__pct-row">
        <span>{formatHybridStockLabel(split)}</span>
        <span>
          {split.preOrder + split.walkUp} total
        </span>
      </div>
    </div>
  );
}
