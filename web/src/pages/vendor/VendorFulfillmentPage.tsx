import { OrdersListSkeleton } from '@/components/orders/OrdersListSkeleton';
import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorEmpty,
  VendorFormPanel,
  VendorHero,
  VendorKpiGrid,
  VendorKpiStat,
  VendorListPanel,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
  VendorSecondaryButton,
  VendorStatusPill,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { useFulfillmentOrders } from '@/hooks/use-fulfillment-orders';
import { formatDateTime, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import type { FulfillmentOrderRow } from '@/hooks/use-fulfillment-orders';
import '@/components/ui/ui.css';

function itemSummary(items: FulfillmentOrderRow['order_items']): string {
  if (items.length === 0) return 'No items';
  const preview = items
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.product?.name ?? item.item_title ?? 'Item'}`)
    .join(', ');
  return items.length > 2 ? `${preview} +${items.length - 2} more` : preview;
}

function FulfillmentOrderRowCard({
  order,
  mode,
  onFulfill,
  fulfilling,
}: {
  order: FulfillmentOrderRow;
  mode: 'pending' | 'fulfilled';
  onFulfill?: (orderId: string) => void;
  fulfilling?: boolean;
}) {
  const shopperLabel =
    order.shopper?.user?.name?.trim() ||
    order.shopper?.user?.email?.trim() ||
    `Order ${order.pickup_code ?? order.id.slice(0, 8)}`;

  return (
    <div className="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconBadge name="package" tone="emerald" />
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-stone-800">{shopperLabel}</p>
            <p className="m-0 mt-0.5 truncate text-xs text-stone-500">{itemSummary(order.order_items)}</p>
            <p className="m-0 mt-0.5 text-xs text-stone-400">
              {formatPrice(order.total)} · {formatDateTime(order.created_at)}
            </p>
            {order.event ? (
              <p className="m-0 mt-0.5 truncate text-xs text-stone-400">{order.event.name}</p>
            ) : null}
          </div>
        </div>
        <VendorStatusPill
          label={ORDER_STATUS_LABEL[order.order_status] ?? order.order_status.replace(/_/g, ' ')}
        />
      </div>

      {mode === 'pending' && onFulfill ? (
        <div className="mt-3 flex gap-2">
          <VendorPrimaryButton
            className="flex-1"
            disabled={fulfilling}
            onClick={() => onFulfill(order.id)}
          >
            {fulfilling ? 'Marking fulfilled…' : 'Mark fulfilled'}
          </VendorPrimaryButton>
          <VendorSecondaryButton to={`/vendor/orders/${order.id}`} className="shrink-0">
            Details
          </VendorSecondaryButton>
        </div>
      ) : (
        <p className="m-0 mt-2 text-xs text-stone-500">Collected {formatDateTime(order.updated_at)}</p>
      )}
    </div>
  );
}

export function VendorFulfillmentPage() {
  const { vendor } = useAuth();
  const {
    markets,
    selectedMarketId,
    setSelectedMarketId,
    pendingOrders,
    fulfilledOrders,
    counts,
    loading,
    error,
    fulfillingIds,
    fulfillOrder,
  } = useFulfillmentOrders(vendor?.id);

  return (
    <VendorScreen>
      <VendorHero eyebrow="Live operations" title="Fulfillment" pill={`${counts.pending} awaiting`} />

      <VendorKpiGrid>
        <VendorKpiStat value={counts.pending} label="Pending pickup" />
        <VendorKpiStat value={counts.fulfilled} label="Fulfilled today" />
      </VendorKpiGrid>

      <VendorSection title="Market session">
        <VendorFormPanel>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Filter by market
            </span>
            <select
              className={`app-input mt-2 w-full ${VENDOR_PRESSABLE}`}
              value={selectedMarketId}
              onChange={(event) =>
                setSelectedMarketId(event.target.value === 'all' ? 'all' : event.target.value)
              }
            >
              <option value="all">All active markets</option>
              {markets.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.name}
                </option>
              ))}
            </select>
          </label>
        </VendorFormPanel>
      </VendorSection>

      {error ? <VendorEmpty message={error} /> : null}

      {loading ? (
        <OrdersListSkeleton count={4} />
      ) : (
        <>
          <VendorSection title="Pending pickup">
            {pendingOrders.length === 0 ? (
              <VendorEmpty message="No shoppers waiting right now." />
            ) : (
              <VendorListPanel>
                {pendingOrders.map((order) => (
                  <FulfillmentOrderRowCard
                    key={order.id}
                    order={order}
                    mode="pending"
                    fulfilling={fulfillingIds.has(order.id)}
                    onFulfill={fulfillOrder}
                  />
                ))}
              </VendorListPanel>
            )}
          </VendorSection>

          <VendorSection title="Fulfilled">
            {fulfilledOrders.length === 0 ? (
              <VendorEmpty message="Fulfilled orders archive here after pickup." />
            ) : (
              <VendorListPanel>
                {fulfilledOrders.map((order) => (
                  <FulfillmentOrderRowCard key={order.id} order={order} mode="fulfilled" />
                ))}
              </VendorListPanel>
            )}
          </VendorSection>
        </>
      )}
    </VendorScreen>
  );
}
