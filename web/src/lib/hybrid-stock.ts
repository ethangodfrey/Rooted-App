/** Pure helpers for pre-order vs walk-up batch allocation. */

export interface HybridStockSplit {
  /** Units reserved for online pre-orders */
  preOrder: number;
  /** Units held for in-person walk-ups */
  walkUp: number;
  /** Pre-order share of the batch, 0–100 */
  preOrderPercent: number;
}

/**
 * Split a batch into integer pre-order / walk-up units.
 * Walk-up absorbs rounding so totals always equal `totalStock`.
 */
export function allocateHybridStock(totalStock: number, preOrderPercent: number): HybridStockSplit {
  const total = Number.isFinite(totalStock) ? Math.max(0, Math.floor(totalStock)) : 0;
  const pct = Number.isFinite(preOrderPercent)
    ? Math.min(100, Math.max(0, Math.round(preOrderPercent)))
    : 0;
  const preOrder = total === 0 ? 0 : Math.round((total * pct) / 100);
  const walkUp = Math.max(0, total - preOrder);
  return { preOrder, walkUp, preOrderPercent: pct };
}

/** Derive slider percent from stored presale / in-person quantities. */
export function percentFromQuantities(presale: number, inperson: number): number {
  const pre = Number.isFinite(presale) ? Math.max(0, Math.floor(presale)) : 0;
  const walk = Number.isFinite(inperson) ? Math.max(0, Math.floor(inperson)) : 0;
  const total = pre + walk;
  if (total <= 0) return 50;
  return Math.round((pre / total) * 100);
}

export function formatHybridStockLabel(split: HybridStockSplit): string {
  return `${split.preOrder} Pre-Order / ${split.walkUp} Walk-Up`;
}
