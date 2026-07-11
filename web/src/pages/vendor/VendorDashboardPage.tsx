import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { IconBadge, type IconName } from '@/components/vendor/dashboard-icons';
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

const tileSurface = `flex min-h-[74px] min-w-0 items-start gap-2.5 rounded-xl border border-stone-200/40 bg-stone-100/60 p-3 no-underline text-inherit ${pressable}`;

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

type BadgeTone = 'amber' | 'emerald' | 'teal' | 'orange' | 'stone' | 'sky' | 'rose';

function OperationTile({
  to,
  title,
  subtitle,
  icon,
  tone,
}: {
  to: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  tone: BadgeTone;
}) {
  return (
    <Link to={to} className={tileSurface}>
      <IconBadge name={icon} tone={tone} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-stone-800">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-stone-500">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function ListRow({
  to,
  title,
  subtitle,
  icon,
  tone,
}: {
  to: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  tone: BadgeTone;
}) {
  return (
    <Link
      to={to}
      className={`app-card--pressable flex items-center justify-between bg-transparent p-3.5 text-left no-underline active:bg-stone-100/80 ${pressable}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <IconBadge name={icon} tone={tone} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-stone-800">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-xs text-stone-500">{subtitle}</span>
          ) : null}
        </span>
      </span>
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
      <div className="mb-5 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-600 to-amber-500 p-5 text-white shadow-md">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-white/80">Vendor</p>
        <h1 className="m-0 mt-1 text-2xl font-bold tracking-tight">Dashboard</h1>
        {user?.email ? (
          <p className="m-0 mt-1 text-sm text-white/85">Signed in as {user.email}</p>
        ) : null}
        <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white backdrop-blur-md">
          {status}
        </span>
        <p className="m-0 mt-2 text-xs leading-snug text-white/90">{statusCopy[status]}</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <KpiStat to="/vendor/fulfillment" value={pendingPickup} label="Awaiting pickup" />
        <KpiStat to="/vendor/fulfillment" value={fulfilledToday} label="Fulfilled today" accent />
        <KpiStat to="/vendor/products" value={activeProducts} label="Active products" />
      </div>

      <DashboardSection title="Operations">
        <div className="grid grid-cols-2 gap-2.5">
          <OperationTile
            to="/vendor/fulfillment"
            title="Fulfillment ledger"
            subtitle="Track live pickups"
            icon="check-square"
            tone="emerald"
          />
          <OperationTile
            to="/vendor/products/new"
            title="Add a product"
            subtitle="Create new listing"
            icon="plus"
            tone="orange"
          />
          <OperationTile
            to="/vendor/events"
            title="My events"
            icon="calendar"
            tone="sky"
          />
          <OperationTile
            to="/vendor/sales/manual"
            title="Log in-person sale"
            icon="receipt"
            tone="stone"
          />
          <OperationTile
            to="/vendor/leftovers"
            title="List leftovers"
            subtitle="Post unsold items"
            icon="recycle"
            tone="rose"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Storefront & Growth">
        <div className={groupedSurface}>
          <ListRow
            to="/vendor/analytics"
            title="Analytics"
            subtitle="Revenue & order trends"
            icon="trending-up"
            tone="amber"
          />
          <ListRow to="/vendor/storefront" title="Edit storefront" icon="store" tone="stone" />
          <ListRow to="/vendor/explore" title="Explore showcase" icon="grid" tone="sky" />
          <ListRow to="/vendor/posts/new" title="Create a post" icon="message" tone="stone" />
        </div>
      </DashboardSection>

      <DashboardSection title="Compliance & Settings">
        <div className={groupedSurface}>
          <ListRow to="/vendor/pos" title="Connect Square POS" icon="credit-card" tone="stone" />
          <ListRow
            to="/vendor/compliance"
            title="Food safety checklist"
            icon="shield-check"
            tone="teal"
          />
          <ListRow
            to="/vendor/credentials"
            title="Verification credentials"
            icon="badge"
            tone="stone"
          />
        </div>
      </DashboardSection>
    </div>
  );
}
