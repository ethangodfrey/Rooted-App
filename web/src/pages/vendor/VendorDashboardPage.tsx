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

const pressable = 'active:scale-[0.99] transition-all';

const groupedSurface =
  'overflow-hidden rounded-xl border border-stone-200/40 bg-stone-100/40 divide-y divide-stone-200/60';

const tileSurface = `block min-w-0 rounded-xl border border-stone-200/40 bg-stone-100/60 p-3 no-underline text-inherit ${pressable}`;

function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 text-stone-400 ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">{title}</p>
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
      className={`app-card--pressable flex min-w-0 flex-col items-center rounded-xl border border-stone-200/40 p-3 text-center no-underline ${pressable} ${
        accent ? 'bg-stone-100/80' : 'bg-stone-100/60'
      }`}
    >
      <p className="m-0 text-2xl font-bold tabular-nums leading-none text-stone-800">{value}</p>
      <p className="m-0 mt-1.5 max-w-full text-[10px] font-semibold uppercase leading-tight tracking-wider text-stone-500">
        {label}
      </p>
    </Link>
  );
}

function OperationTile({
  to,
  title,
  subtitle,
}: {
  to: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link
      to={to}
      className={`${tileSurface}${subtitle ? ' min-h-[74px]' : ''}`}
    >
      <p className="m-0 truncate text-sm font-semibold text-stone-800">{title}</p>
      {subtitle ? (
        <p className="m-0 mt-0.5 line-clamp-2 text-xs leading-snug text-stone-500">{subtitle}</p>
      ) : null}
    </Link>
  );
}

function GrowthRow({
  to,
  title,
  subtitle,
}: {
  to: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link
      to={to}
      className={`app-card--pressable block p-3.5 no-underline text-inherit ${pressable}`}
    >
      <p className="m-0 text-sm font-semibold text-stone-800">{title}</p>
      {subtitle ? (
        <p className="m-0 mt-0.5 text-xs leading-snug text-stone-500">{subtitle}</p>
      ) : null}
    </Link>
  );
}

function SettingsRow({ to, title }: { to: string; title: string }) {
  return (
    <Link
      to={to}
      className={`app-card--pressable flex items-center justify-between p-3.5 no-underline text-inherit ${pressable}`}
    >
      <span className="truncate text-sm font-medium text-stone-800">{title}</span>
      <ChevronRight />
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

      <div className="mb-4 rounded-xl border border-stone-200/40 bg-stone-100/60 p-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-stone-500">
          Approval status
        </p>
        <p className="m-0 mt-1 text-sm font-semibold capitalize text-stone-800">{status}</p>
        <p className="m-0 mt-0.5 text-xs leading-snug text-stone-500">{statusCopy[status]}</p>
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
            subtitle="Track live pickups"
          />
          <OperationTile to="/vendor/products/new" title="Add a product" subtitle="Create new listing" />
          <OperationTile to="/vendor/events" title="My events" />
          <OperationTile to="/vendor/sales/manual" title="Log in-person sale" />
          <OperationTile to="/vendor/leftovers" title="List leftovers" subtitle="Post unsold items" />
        </div>
      </DashboardSection>

      <DashboardSection title="Storefront & Growth">
        <div className={groupedSurface}>
          <GrowthRow to="/vendor/analytics" title="Analytics" subtitle="Revenue & order trends" />
          <GrowthRow to="/vendor/storefront" title="Edit storefront" />
          <GrowthRow to="/vendor/explore" title="Explore showcase" />
          <GrowthRow to="/vendor/posts/new" title="Create a post" />
        </div>
      </DashboardSection>

      <DashboardSection title="Compliance & Settings">
        <div className={groupedSurface}>
          <SettingsRow to="/vendor/pos" title="Connect Square POS" />
          <SettingsRow to="/vendor/compliance" title="Food safety checklist" />
          <SettingsRow to="/vendor/credentials" title="Verification credentials" />
        </div>
      </DashboardSection>
    </div>
  );
}
