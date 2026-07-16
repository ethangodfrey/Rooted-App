import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { usePosLedger } from '@/hooks/use-pos-ledger';
import { PENDING_PICKUP_STATUSES } from '@/lib/order-fulfillment';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  VendorActionGrid,
  VendorActionTile,
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
  const grossValue =
    !posLoading && posSummary.transactionCount > 0
      ? formatPrice(posSummary.grossTotal)
      : formatPrice(0);

  return (
    <VendorScreen>
      <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
        Vendor workspace
      </p>
      <h1 className="app-title" style={{ marginBottom: '0.35rem' }}>
        Dashboard
      </h1>
      <p className="ft-subhead" style={{ marginBottom: '1.25rem' }}>
        {user?.email ? `Signed in as ${user.email}` : 'Merchant console'}
        {' · '}
        <span className="capitalize">{status}</span>
        {' — '}
        {statusCopy[status]}
      </p>

      <div className="vendor-asym">
        <Link to="/vendor/analytics" className="vendor-asym__hero no-underline">
          <p className="ft-label">Gross revenue</p>
          <p className="ft-metric">{grossValue}</p>
          <p className="ft-subhead" style={{ marginTop: '0.65rem' }}>
            {posLoading
              ? 'Syncing POS ledger…'
              : posSummary.transactionCount > 0
                ? `${posSummary.transactionCount} POS ops · last 30 days`
                : 'Connect Square to populate live gross'}
          </p>
        </Link>

        <div className="vendor-asym__stack">
          <Link to="/vendor/fulfillment" className="vendor-asym__stat">
            <p className="ft-label">Total operations</p>
            <p className="ft-metric">{pendingPickup + fulfilledToday}</p>
            <p className="ft-subhead" style={{ marginTop: '0.35rem' }}>
              {pendingPickup} awaiting · {fulfilledToday} fulfilled today
            </p>
          </Link>
          <div className="vendor-asym__stat vendor-asym__action">
            <p className="ft-label">Quick actions</p>
            <p className="ft-subhead" style={{ marginTop: '0.35rem', marginBottom: '0.85rem' }}>
              {activeProducts} active SKUs in your catalog
            </p>
            <Link
              to={
                vendor?.id
                  ? `/vendor/inventory?vendorId=${encodeURIComponent(vendor.id)}`
                  : '/vendor/inventory'
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:bg-orange-500 active:scale-[0.98] no-underline"
            >
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              Manage Inventory
            </Link>
          </div>
        </div>
      </div>

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
          <div className="vendor-asym" style={{ marginBottom: '1rem' }}>
            <Link to="/vendor/analytics" className="vendor-asym__stat">
              <p className="ft-label">Platform fees</p>
              <p className="ft-metric" style={{ fontSize: '1.75rem' }}>
                {formatPrice(posSummary.platformFeeTotal)}
              </p>
            </Link>
            <Link to="/vendor/analytics" className="vendor-asym__stat">
              <p className="ft-label">Net (30d)</p>
              <p className="ft-metric" style={{ fontSize: '1.75rem' }}>
                {formatPrice(posSummary.netTotal)}
              </p>
            </Link>
          </div>
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
          <VendorListRow
            to="/vendor/onboarding"
            title="Vendor type"
            subtitle="Market, Home Chef, or Private Chef"
            icon="store"
            tone="sky"
          />
          <VendorListRow
            to="/vendor/settings/fulfillment"
            title="Fulfillment & services"
            subtitle="Pickup, delivery, or private dining rates"
            icon="check-square"
            tone="emerald"
          />
          <VendorListRow
            to="/vendor/settings/payments"
            title="Payment settings"
            subtitle="Stripe Connect & pay-at-pickup"
            icon="credit-card"
            tone="amber"
          />
          <VendorListRow to="/vendor/pos" title="Connect Square POS" icon="credit-card" tone="stone" />
          <VendorListRow to="/vendor/compliance" title="Food safety checklist" icon="shield-check" tone="teal" />
          <VendorListRow to="/vendor/credentials" title="Verification credentials" icon="badge" tone="stone" />
        </VendorListPanel>
      </VendorSection>
    </VendorScreen>
  );
}
