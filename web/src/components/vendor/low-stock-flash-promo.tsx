import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_FLASH_DISCOUNT_PERCENT,
  flashSaleBadgeText,
  isLowWalkUpStock,
  mergeFlashSaleIntoTheme,
  type FlashSaleState,
} from '@/lib/flash-sale';
import { supabase } from '@/lib/supabase';

const TACTILE_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

export interface LowStockItem {
  productId: string;
  productName: string;
  walkUpStock: number;
  flashActive: boolean;
}

interface LowStockFlashPromoProps {
  vendorId: string | undefined;
}

export function LowStockFlashPromo({ vendorId }: LowStockFlashPromoProps) {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    setError(null);

    const [productsRes, vendorRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, product_event_availability(available_quantity_inperson)')
        .eq('vendor_id', vendorId)
        .eq('status', 'active'),
      supabase.from('vendors').select('theme_settings').eq('id', vendorId).maybeSingle(),
    ]);

    if (productsRes.error) {
      setError(productsRes.error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const theme = (vendorRes.data?.theme_settings ?? null) as Record<string, unknown> | null;
    const activeFlashId =
      theme &&
      typeof theme.flash_sale === 'object' &&
      theme.flash_sale &&
      (theme.flash_sale as { active?: boolean; productId?: string }).active === true
        ? String((theme.flash_sale as { productId?: string }).productId ?? '')
        : '';

    const next: LowStockItem[] = [];
    for (const product of productsRes.data ?? []) {
      const rows = (product.product_event_availability ?? []) as Array<{
        available_quantity_inperson: number;
      }>;
      if (rows.length === 0) continue;
      const walkUp = Math.min(...rows.map((r) => Number(r.available_quantity_inperson) || 0));
      if (!isLowWalkUpStock(walkUp)) continue;
      next.push({
        productId: product.id as string,
        productName: product.name as string,
        walkUpStock: walkUp,
        flashActive: activeFlashId === product.id,
      });
    }
    next.sort((a, b) => a.walkUpStock - b.walkUpStock);
    setItems(next);
    setLoading(false);
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function promote(item: LowStockItem) {
    if (!vendorId) return;
    setPromotingId(item.productId);
    setError(null);
    setMessage(null);

    const { data: vendorRow, error: vendorError } = await supabase
      .from('vendors')
      .select('theme_settings')
      .eq('id', vendorId)
      .maybeSingle();

    if (vendorError) {
      setError(vendorError.message);
      setPromotingId(null);
      return;
    }

    const flash: FlashSaleState = {
      active: true,
      productId: item.productId,
      productName: item.productName,
      unitsLeft: item.walkUpStock,
      discountPercent: DEFAULT_FLASH_DISCOUNT_PERCENT,
      activatedAt: new Date().toISOString(),
    };

    const theme_settings = mergeFlashSaleIntoTheme(
      (vendorRow?.theme_settings as Record<string, unknown> | null) ?? {},
      flash,
    );

    const { error: patchError } = await supabase
      .from('vendors')
      .update({ theme_settings })
      .eq('id', vendorId);

    setPromotingId(null);

    if (patchError) {
      setError(patchError.message);
      return;
    }

    setMessage(flashSaleBadgeText(item.walkUpStock));
    setItems((prev) =>
      prev.map((row) => ({
        ...row,
        flashActive: row.productId === item.productId,
      })),
    );
  }

  if (loading || items.length === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      {items.map((item) => (
        <div
          key={item.productId}
          className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-4"
        >
          <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-500 opacity-90">
            Low walk-up stock
          </p>
          <p className="m-0 mt-1 text-sm font-semibold text-[var(--color-text)]">
            {item.productName} · {item.walkUpStock} left for in-person sales
          </p>
          <p className="m-0 mt-1 text-xs font-medium text-[var(--color-muted)]">
            Push a {DEFAULT_FLASH_DISCOUNT_PERCENT}% flash sale to the shopper directory before the
            table runs empty.
          </p>
          <button
            type="button"
            className={`${TACTILE_BTN} mt-3 w-full`}
            disabled={promotingId === item.productId || item.flashActive}
            onClick={() => void promote(item)}
          >
            {item.flashActive
              ? 'Flash Sale Active'
              : promotingId === item.productId
                ? 'Promoting…'
                : 'Promote Last 3 Items'}
          </button>
        </div>
      ))}
      {message ? (
        <p className="m-0 text-sm font-semibold text-orange-500" role="status">
          Live on shopper directory: {message}
        </p>
      ) : null}
      {error ? <p className="app-error m-0">{error}</p> : null}
    </div>
  );
}
