import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSection,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import {
  completePreorderHandoff,
  fetchVendorPreorders,
  type PreorderOrderRow,
} from '@/lib/preorders';
import '@/components/ui/ui.css';

type Tab = 'PENDING_PICKUP' | 'COMPLETED';

function paymentSticker(order: PreorderOrderRow): string {
  if (order.payment_status === 'PAID') return 'PAID';
  return 'PAY AT PICKUP';
}

function itemBreakdown(order: PreorderOrderRow): string {
  if (order.items.length === 0) return 'No items';
  return order.items
    .map((item) => `${item.quantity}x ${item.product?.name ?? 'Item'}`)
    .join(' · ');
}

export function VendorHandoffsPage() {
  const { user, vendor } = useAuth();
  const vendorUserId = user?.id ?? vendor?.user_id ?? null;
  const [tab, setTab] = useState<Tab>('PENDING_PICKUP');
  const [orders, setOrders] = useState<PreorderOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendorUserId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchVendorPreorders(vendorUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load hand-offs.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [vendorUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => orders.filter((o) => o.status === 'PENDING_PICKUP'),
    [orders],
  );
  const completed = useMemo(
    () => orders.filter((o) => o.status === 'COMPLETED'),
    [orders],
  );
  const visible = tab === 'PENDING_PICKUP' ? pending : completed;

  async function onComplete(order: PreorderOrderRow) {
    const code = (codes[order.id] ?? '').trim().toUpperCase();
    if (!code) {
      setError('Enter the pickup verification code.');
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      await completePreorderHandoff(order.id, code);
      setCodes((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete hand-off.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Operations"
        title="Hand-offs"
        pill={`${pending.length} pending`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={`app-btn app-btn--small ${VENDOR_PRESSABLE}${tab === 'PENDING_PICKUP' ? ' app-btn--primary' : ' app-btn--secondary'}`}
          onClick={() => setTab('PENDING_PICKUP')}
        >
          PENDING PICKUP ({pending.length})
        </button>
        <button
          type="button"
          className={`app-btn app-btn--small ${VENDOR_PRESSABLE}${tab === 'COMPLETED' ? ' app-btn--primary' : ' app-btn--secondary'}`}
          onClick={() => setTab('COMPLETED')}
        >
          COMPLETED ({completed.length})
        </button>
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : visible.length === 0 ? (
        <VendorEmpty
          message={
            tab === 'PENDING_PICKUP'
              ? 'No pending pickups. Pre-orders appear here after a shopper confirms.'
              : 'No completed hand-offs yet.'
          }
        />
      ) : (
        <VendorSection title={tab === 'PENDING_PICKUP' ? 'PENDING PICKUP' : 'COMPLETED'}>
          <VendorListPanel>
            {visible.map((order) => {
              const shopperName =
                order.shopper?.name?.trim() ||
                order.shopper?.email?.trim() ||
                'Shopper';
              return (
                <div key={order.id} className="p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                        {order.status.replace(/_/g, ' ')} · {paymentSticker(order)}
                      </p>
                      <p className="m-0 mt-1 truncate text-sm font-semibold text-stone-800">
                        {shopperName}
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-stone-500">
                        {itemBreakdown(order)}
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-stone-400">
                        {formatPrice(order.total_amount)} · {order.fulfillment_label}
                        {order.event?.name ? ` · ${order.event.name}` : ''}
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-stone-400">
                        {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-lg bg-orange-500/15 px-2.5 py-1 font-mono text-xs font-extrabold tracking-[0.14em] text-orange-700">
                      {order.pickup_code}
                    </span>
                  </div>

                  {tab === 'PENDING_PICKUP' ? (
                    <div className="mt-3 space-y-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                          Verification code
                        </span>
                        <input
                          className="app-input w-full font-mono tracking-[0.14em] uppercase"
                          placeholder="RT-000"
                          value={codes[order.id] ?? ''}
                          onChange={(e) =>
                            setCodes((prev) => ({
                              ...prev,
                              [order.id]: e.target.value.toUpperCase(),
                            }))
                          }
                          maxLength={6}
                        />
                      </label>
                      <button
                        type="button"
                        className={`app-btn app-btn--primary app-btn--small ${VENDOR_PRESSABLE}`}
                        disabled={busyId === order.id}
                        onClick={() => void onComplete(order)}
                      >
                        {busyId === order.id
                          ? 'COMPLETING…'
                          : '[ COMPLETE HAND-OFF ]'}
                      </button>
                    </div>
                  ) : (
                    <p className="m-0 mt-2 text-xs text-stone-500">
                      Completed{' '}
                      {order.completed_at
                        ? formatDateTime(order.completed_at)
                        : formatDateTime(order.created_at)}
                    </p>
                  )}
                </div>
              );
            })}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
