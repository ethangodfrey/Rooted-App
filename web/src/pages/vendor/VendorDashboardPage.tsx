import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { usePosLedger } from '@/hooks/use-pos-ledger';
import { PENDING_PICKUP_STATUSES } from '@/lib/order-fulfillment';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  VendorActionGrid,
  VendorActionTile,
  VendorHero,
  VendorKpiGrid,
  VendorKpiStat,
  VendorListPanel,
  VendorListRow,
  VendorScreen,
  VendorSection,
  VendorSecondaryButton,
} from '@/components/vendor/vendor-ui';
import { PosLiveTransactionFeed } from '@/components/vendor/pos-live-transaction-feed';
import { SquarePosConnectionCard } from '@/components/vendor/square-pos-connection-card';
import '@/components/ui/ui.css';

const statusCopy: Record<string, string> = {
  pending: 'Your vendor account is pending admin approval.',
  approved: 'Your storefront is live and visible to shoppers.',
  rejected: 'Your vendor application was not approved. Contact support.',
};

export function VendorDashboardPage() {
  const { user, vendor } = useAuth();
  const {
    summary: posSummary,
    liveFeed,
    connections: posConnections,
    hasActiveConnection,
    loading: posLoading,
    error: posError,
    realtimeStatus,
  } = usePosLedger({ vendorId: vendor?.id, range: 30 });
  const [pendingPickup, setPendingPickup] = useState(0);
  const [fulfilledToday, setFulfilledToday] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);

  useEffect(() => {
    async function load() {
      if (!vendor) return;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [pendingRes, fulfilledRes, productsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendor.id)
          .in('order_status', PENDING_PICKUP_STATUSES),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendor.id)
          .in('order_status', ['fulfilled', 'completed'])
          .gte('updated_at', startOfDay.toISOString()),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendor.id)
          .eq('status', 'active'),
      ]);

      setPendingPickup(pendingRes.count ?? 0);
      setFulfilledToday(fulfilledRes.count ?? 0);
      setActiveProducts(productsRes.count ?? 0);
    }
    void load();
  }, [vendor]);

  const status = vendor?.approval_status ?? 'pending';

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Vendor"
        title="Dashboard"
        subtitle={user?.email ? `Signed in as ${user.email}` : undefined}
        pill={status}
      >
        <p className="m-0 mt-2 text-xs leading-snug text-white/90">{statusCopy[status]}</p>
      </VendorHero>

      <VendorKpiGrid cols={3}>
        <VendorKpiStat to="/vendor/fulfillment" value={pendingPickup} label="Awaiting pickup" />
        <VendorKpiStat to="/vendor/fulfillment" value={fulfilledToday} label="Fulfilled today" />
        <VendorKpiStat to="/vendor/products" value={activeProducts} label="Active products" />
      </VendorKpiGrid>

      <VendorSection title="POS sales">
        <div className="mb-4">
          <SquarePosConnectionCard
            vendorId={vendor?.id}
            connections={posConnections}
            loading={posLoading}
          />
        </div>
        {posError ? <p className="app-error mb-3">{posError}</p> : null}
        {!posLoading && posSummary.transactionCount > 0 ? (
          <VendorKpiGrid cols={3}>
            <VendorKpiStat
              to="/vendor/analytics"
              value={formatPrice(posSummary.grossTotal)}
              label="Gross (30d)"
            />
            <VendorKpiStat
              to="/vendor/analytics"
              value={formatPrice(posSummary.platformFeeTotal)}
              label="Platform fees"
            />
            <VendorKpiStat
              to="/vendor/analytics"
              value={formatPrice(posSummary.netTotal)}
              label="Net (30d)"
            />
          </VendorKpiGrid>
        ) : null}
        <div className={posSummary.transactionCount > 0 ? 'mt-4' : undefined}>
          <PosLiveTransactionFeed
            feed={liveFeed}
            realtimeStatus={realtimeStatus}
            loading={posLoading}
            hasActiveConnection={hasActiveConnection}
          />
        </div>
        {!posLoading && hasActiveConnection ? (
          <div className="mt-3">
            <VendorSecondaryButton to="/vendor/pos">POS settings</VendorSecondaryButton>
          </div>
        ) : null}
      </VendorSection>

      <VendorSection title="Operations">
        <VendorActionGrid>
          <VendorActionTile
            to="/vendor/fulfillment"
            title="Fulfillment ledger"
            subtitle="Track live pickups"
            icon="check-square"
            tone="emerald"
          />
          <VendorActionTile
            to="/vendor/products/new"
            title="Add a product"
            subtitle="Create new listing"
            icon="plus"
            tone="orange"
          />
          <VendorActionTile to="/vendor/events" title="My events" icon="calendar" tone="sky" />
          <VendorActionTile to="/vendor/sales/manual" title="Log in-person sale" icon="receipt" tone="stone" />
          <VendorActionTile
            to="/vendor/leftovers"
            title="List leftovers"
            subtitle="Post unsold items"
            icon="recycle"
            tone="rose"
          />
        </VendorActionGrid>
      </VendorSection>

      <VendorSection title="Storefront & Growth">
        <VendorListPanel>
          <VendorListRow
            to="/vendor/analytics"
            title="Analytics"
            subtitle="Revenue & order trends"
            icon="trending-up"
            tone="amber"
          />
          <VendorListRow to="/vendor/storefront" title="Edit storefront" icon="store" tone="stone" />
          <VendorListRow to="/vendor/explore" title="Explore showcase" icon="grid" tone="sky" />
          <VendorListRow to="/vendor/posts/new" title="Create a post" icon="message" tone="stone" />
        </VendorListPanel>
      </VendorSection>

      <VendorSection title="Compliance & Settings">
        <VendorListPanel>
          <VendorListRow to="/vendor/pos" title="Connect Square POS" icon="credit-card" tone="stone" />
          <VendorListRow to="/vendor/compliance" title="Food safety checklist" icon="shield-check" tone="teal" />
          <VendorListRow to="/vendor/credentials" title="Verification credentials" icon="badge" tone="stone" />
        </VendorListPanel>
      </VendorSection>
    </VendorScreen>
  );
}
