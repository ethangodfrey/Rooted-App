import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { PENDING_PICKUP_STATUSES } from '@/lib/order-fulfillment';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const statusCopy: Record<string, string> = {
  pending: 'Your vendor account is pending admin approval.',
  approved: 'Your storefront is live and visible to shoppers.',
  rejected: 'Your vendor application was not approved. Contact support.',
};

const surfaceCard =
  'rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-white)] no-underline text-inherit';
const surfaceCardHoneydew =
  'rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-honeydew)] no-underline text-inherit';

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {title}
      </p>
      {children}
    </section>
  );
}

function KpiStat({
  to,
  value,
  label,
  accent,
}: {
  to: string;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`app-card--pressable flex min-w-0 flex-col items-center p-3 text-center ${accent ? surfaceCardHoneydew : surfaceCard}`}
    >
      <p className="m-0 text-2xl font-bold tabular-nums leading-none text-[var(--color-text)]">
        {value}
      </p>
      <p className="m-0 mt-1.5 max-w-full text-[10px] font-semibold uppercase leading-tight tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
    </Link>
  );
}

function GrowthCard({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className={`app-card--pressable block p-3 ${surfaceCardHoneydew}`}>
      <p className="m-0 text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="m-0 mt-0.5 text-xs leading-snug text-[var(--color-muted)]">{description}</p>
    </Link>
  );
}

function CompactAction({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description?: string;
}) {
  return (
    <Link
      to={to}
      className={`app-card--pressable flex min-w-0 items-center justify-between gap-2 px-3 py-2.5 ${surfaceCard}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--color-text)]">{title}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--color-muted)]">{description}</span>
        ) : null}
      </span>
      <span aria-hidden className="shrink-0 text-sm text-[var(--color-muted)]">
        ›
      </span>
    </Link>
  );
}

function OperationTile({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description?: string;
}) {
  return (
    <Link to={to} className={`app-card--pressable block min-w-0 p-3 ${surfaceCard}`}>
      <p className="m-0 truncate text-sm font-semibold text-[var(--color-text)]">{title}</p>
      {description ? (
        <p className="m-0 mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--color-muted)]">
          {description}
        </p>
      ) : null}
    </Link>
  );
}

export function VendorDashboardPage() {
  const { user, vendor } = useAuth();
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
    <div className="app-screen min-w-0 px-4 pb-10">
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">Dashboard</h1>
      <p className="app-subtitle mb-4">{user?.email ? `Signed in as ${user.email}` : ''}</p>

      <div className={`mb-4 p-3 ${surfaceCardHoneydew}`}>
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Approval status
        </p>
        <p className="m-0 mt-1 text-sm font-semibold capitalize text-[var(--color-text)]">{status}</p>
        <p className="m-0 mt-0.5 text-xs leading-snug text-[var(--color-muted)]">{statusCopy[status]}</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <KpiStat to="/vendor/fulfillment" value={pendingPickup} label="Awaiting pickup" />
        <KpiStat to="/vendor/fulfillment" value={fulfilledToday} label="Fulfilled today" accent />
        <KpiStat to="/vendor/products" value={activeProducts} label="Active products" />
      </div>

      <DashboardSection title="Operations">
        <div className="grid grid-cols-2 gap-2">
          <OperationTile
            to="/vendor/fulfillment"
            title="Fulfillment ledger"
            description="Mark pickups complete and track live counters"
          />
          <OperationTile to="/vendor/products/new" title="Add a product" />
          <OperationTile to="/vendor/events" title="My events" />
          <OperationTile to="/vendor/sales/manual" title="Log in-person sale" />
          <OperationTile
            to="/vendor/leftovers"
            title="List leftovers"
            description="Post unsold items after market days"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Storefront & Growth">
        <div className="flex flex-col gap-2">
          <GrowthCard
            to="/vendor/analytics"
            title="Analytics"
            description="Revenue, units sold, and order trends"
          />
          <GrowthCard
            to="/vendor/storefront"
            title="Edit storefront"
            description="Update your shop profile, photos, and pickup details"
          />
          <GrowthCard
            to="/vendor/explore"
            title="Explore showcase"
            description="Publish portfolio posts to the customer Explore feed"
          />
          <GrowthCard
            to="/vendor/posts/new"
            title="Create a post"
            description="Share updates, photos, and announcements with shoppers"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Compliance & Settings">
        <div className="flex flex-col gap-1.5">
          <CompactAction to="/vendor/pos" title="Connect Square POS" />
          <CompactAction
            to="/vendor/compliance"
            title="Food safety checklist"
            description="Cottage food requirements and compliance status"
          />
          <CompactAction
            to="/vendor/credentials"
            title="Verification credentials"
            description="Upload documents to earn trust badges"
          />
        </div>
      </DashboardSection>
    </div>
  );
}
