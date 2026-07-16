/** Pure helpers for pre-order vs walk-up batch allocation. */

export interface HybridStockSplit {
  preOrder: number;
  walkUp: number;
  preOrderPercent: number;
}

export function allocateHybridStock(totalStock: number, preOrderPercent: number): HybridStockSplit {
  const total = Number.isFinite(totalStock) ? Math.max(0, Math.floor(totalStock)) : 0;
  const pct = Number.isFinite(preOrderPercent)
    ? Math.min(100, Math.max(0, Math.round(preOrderPercent)))
    : 0;
  const preOrder = total === 0 ? 0 : Math.round((total * pct) / 100);
  const walkUp = Math.max(0, total - preOrder);
  return { preOrder, walkUp, preOrderPercent: pct };
}

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
