import { useCallback, useEffect, useState } from 'react';

import { api, isApiConfigured } from '@/lib/api';
import {
  DEFAULT_FLASH_DISCOUNT_PERCENT,
  flashSaleBadgeText,
  isLowWalkUpStock,
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

interface FlashPromoCampaign {
  active: boolean;
  productId: string;
  productName: string;
  unitsLeft: number;
  discountPercent: number;
  activatedAt: string;
  expiresAt?: string | null;
}

interface FlashPromoWidgetProps {
  vendorId: string | undefined;
}

/**
 * Vendor dashboard flash-promo control.
 * Loads low walk-up stock candidates from Supabase, then creates campaigns via
 * Nest `POST /api/vendors/flash-promo`.
 */
export function FlashPromoWidget({ vendorId }: FlashPromoWidgetProps) {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<FlashPromoCampaign | null>(null);
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

    let campaign: FlashPromoCampaign | null = null;
    if (isApiConfigured) {
      try {
        campaign = await api.get<FlashPromoCampaign | null>('/api/vendors/flash-promo');
      } catch {
        campaign = null;
      }
    }
    setActiveCampaign(campaign);

    const productsRes = await supabase
      .from('products')
      .select('id, name, product_event_availability(available_quantity_inperson)')
      .eq('vendor_id', vendorId)
      .eq('status', 'active');

    if (productsRes.error) {
      setError(productsRes.error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const activeFlashId = campaign?.active ? campaign.productId : '';
    const next: LowStockItem[] = [];
    for (const product of productsRes.data ?? []) {
      const rows = (product.product_event_availability ?? []) as Array<{
        available_quantity_inperson: number;
      }>;
      if (rows.length === 0) continue;
      const walkUp = Math.min(...rows.map((r) => Number(r.available_quantity_inperson) || 0));
      if (!isLowWalkUpStock(walkUp) && product.id !== activeFlashId) continue;
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

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('FLASH_PROMO_WIRED');
  }, []);

  async function promote(item: LowStockItem) {
    if (!vendorId) return;
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL to enable flash promos.');
      return;
    }

    setPromotingId(item.productId);
    setError(null);
    setMessage(null);

    try {
      const campaign = await api.post<FlashPromoCampaign>('/api/vendors/flash-promo', {
        productId: item.productId,
        productName: item.productName,
        unitsLeft: item.walkUpStock,
        discountPercent: DEFAULT_FLASH_DISCOUNT_PERCENT,
      });
      // eslint-disable-next-line no-console
      console.log(
        `FLASH_PROMO_WIRED PRODUCT=${campaign.productId} DISCOUNT=${campaign.discountPercent}`,
      );
      setActiveCampaign(campaign);
      setMessage(flashSaleBadgeText(campaign.unitsLeft));
      setItems((prev) =>
        prev.map((row) => ({
          ...row,
          flashActive: row.productId === campaign.productId,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLASH_PROMO_FAILED');
    } finally {
      setPromotingId(null);
    }
  }

  async function clearPromo() {
    if (!isApiConfigured) return;
    setError(null);
    try {
      await api.del('/api/vendors/flash-promo');
      setActiveCampaign(null);
      setMessage(null);
      setItems((prev) => prev.map((row) => ({ ...row, flashActive: false })));
      // eslint-disable-next-line no-console
      console.log('FLASH_PROMO_WIRED STATE=CLEARED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLASH_PROMO_CLEAR_FAILED');
    }
  }

  if (loading) return null;
  if (items.length === 0 && !activeCampaign) return null;

  return (
    <div className="mb-5 space-y-3">
      {activeCampaign?.active ? (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/15 px-4 py-4">
          <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Active flash promo
          </p>
          <p className="m-0 mt-1 text-sm font-semibold text-[var(--color-text)]">
            {activeCampaign.productName} · {activeCampaign.discountPercent}% off ·{' '}
            {activeCampaign.unitsLeft} left
          </p>
          <p className="m-0 mt-1 text-xs font-medium text-[var(--color-muted)]">
            {flashSaleBadgeText(activeCampaign.unitsLeft)}
          </p>
          <button type="button" className={`${TACTILE_BTN} mt-3 w-full`} onClick={() => void clearPromo()}>
            End flash promo
          </button>
        </div>
      ) : null}

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
                : 'Promote Last Items'}
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

/** @deprecated Prefer FlashPromoWidget */
export const LowStockFlashPromo = FlashPromoWidget;
