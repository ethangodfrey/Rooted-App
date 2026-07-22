import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import {
  DEFAULT_FLASH_DISCOUNT_PERCENT,
  isLowWalkUpStock,
} from '@/lib/flash-sale';
import { supabase } from '@/lib/supabase';
import { vendorTypeToClassification } from '@/lib/vendor-types';
import {
  VendorFormPanel,
  VendorPrimaryButton,
  VendorSection,
} from '@/components/vendor/vendor-ui';

interface FlashCandidate {
  productId: string;
  productName: string;
  unitsLeft: number;
}

interface FlashCampaign {
  active: boolean;
  productId: string;
  productName: string;
  unitsLeft: number;
  discountPercent: number;
}

const ELIGIBLE = new Set(['HOME', 'MICRO_BRAND']);

/**
 * Phase 83f — dashboard widget for HOME / MICRO_BRAND flash sales via FlashPromoService.
 */
export function FlashPromoWidget() {
  const { vendor } = useAuth();
  const classification = vendorTypeToClassification(vendor?.vendor_type);
  const eligible = classification != null && ELIGIBLE.has(classification);

  const [candidates, setCandidates] = useState<FlashCandidate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [discount, setDiscount] = useState(DEFAULT_FLASH_DISCOUNT_PERCENT);
  const [active, setActive] = useState<FlashCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor?.id || !eligible) return;
    setError(null);

    try {
      const campaign = await api.get<FlashCampaign | null>('/api/vendors/flash-promo');
      setActive(campaign?.active ? campaign : null);
    } catch {
      setActive(null);
    }

    const { data, error: productError } = await supabase
      .from('products')
      .select('id, name, product_event_availability(available_quantity_inperson)')
      .eq('vendor_id', vendor.id)
      .eq('status', 'active');

    if (productError) {
      setError(productError.message);
      return;
    }

    const next: FlashCandidate[] = [];
    for (const product of data ?? []) {
      const rows = (product.product_event_availability ?? []) as Array<{
        available_quantity_inperson: number;
      }>;
      const units =
        rows.length > 0
          ? Math.min(...rows.map((r) => Number(r.available_quantity_inperson) || 0))
          : 0;
      if (!isLowWalkUpStock(units) && units > 12) continue;
      next.push({
        productId: product.id as string,
        productName: product.name as string,
        unitsLeft: units,
      });
    }
    next.sort((a, b) => a.unitsLeft - b.unitsLeft);
    setCandidates(next);
    if (!selectedId && next[0]) setSelectedId(next[0].productId);
  }, [vendor?.id, eligible, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!eligible || !vendor?.id) return null;

  const selected = candidates.find((c) => c.productId === selectedId) ?? candidates[0];

  async function triggerFlash() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const campaign = await api.post<FlashCampaign>('/api/vendors/flash-promo', {
        productId: selected.productId,
        productName: selected.productName,
        unitsLeft: selected.unitsLeft,
        discountPercent: discount,
      });
      setActive(campaign);
      setMessage(`FLASH_PROMO_CREATED PRODUCT=${campaign.productId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'FLASH_PROMO_FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function clearFlash() {
    setBusy(true);
    setError(null);
    try {
      await api.del('/api/vendors/flash-promo');
      setActive(null);
      setMessage('FLASH_PROMO_CLEARED');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'FLASH_PROMO_CLEAR_FAILED');
    } finally {
      setBusy(false);
    }
  }

  return (
    <VendorSection title="Flash promo">
      <VendorFormPanel>
        <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-stone-400">
          {classification} · FlashPromoService
        </p>
        <p className="mt-2 text-sm text-stone-600">
          Trigger a short flash sale on a catalog SKU. Ideal for HOME kitchens and MICRO_BRAND
          makers clearing limited inventory.
        </p>

        {active ? (
          <div className="mt-4 rounded-xl border border-orange-500/35 bg-orange-500/10 px-4 py-3">
            <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-widest text-orange-700">
              ACTIVE · {active.discountPercent}% OFF
            </p>
            <p className="m-0 mt-1 text-sm font-semibold text-stone-900">{active.productName}</p>
            <p className="m-0 mt-1 text-xs text-stone-500">
              {active.unitsLeft} units · {active.productId.slice(0, 8)}
            </p>
            <button
              type="button"
              className="mt-3 text-xs font-bold uppercase tracking-wider text-orange-700 underline"
              disabled={busy}
              onClick={() => void clearFlash()}
            >
              End flash sale
            </button>
          </div>
        ) : candidates.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No low-stock SKUs ready for a flash promo. Add walk-up inventory to unlock this
            control.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className="block text-xs font-semibold text-stone-600">
              Product
              <select
                className="app-input mt-1"
                value={selected?.productId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {candidates.map((c) => (
                  <option key={c.productId} value={c.productId}>
                    {c.productName} ({c.unitsLeft} left)
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-stone-600">
              Discount %
              <input
                className="app-input mt-1"
                type="number"
                min={1}
                max={90}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || DEFAULT_FLASH_DISCOUNT_PERCENT)}
              />
            </label>
            <VendorPrimaryButton disabled={busy || !selected} onClick={() => void triggerFlash()}>
              {busy ? 'Starting…' : 'Start flash sale'}
            </VendorPrimaryButton>
          </div>
        )}

        {message ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? <p className="app-error mt-3">{error}</p> : null}
      </VendorFormPanel>
    </VendorSection>
  );
}
