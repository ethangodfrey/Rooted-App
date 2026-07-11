import { useEffect, useState } from 'react';
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
    <div className="app-screen">
      <p className="app-eyebrow">Vendor</p>
      <h1 className="app-title">Dashboard</h1>
      <p className="app-subtitle">{user?.email ? `Signed in as ${user.email}` : ''}</p>

      <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
        <p className="app-row-meta">Approval status</p>
        <p className="app-row-title" style={{ textTransform: 'capitalize' }}>{status}</p>
        <p className="app-row-meta">{statusCopy[status]}</p>
      </div>

      <div className="app-dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <Link to="/vendor/fulfillment" className="app-card app-card--pressable" style={{ minHeight: 88 }}>
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>{pendingPickup}</p>
          <p className="app-row-meta">Pending pickup</p>
        </Link>
        <Link to="/vendor/fulfillment" className="app-card app-card--pressable app-card--honeydew" style={{ minHeight: 88 }}>
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>{fulfilledToday}</p>
          <p className="app-row-meta">Fulfilled today</p>
        </Link>
        <Link to="/vendor/products" className="app-card app-card--pressable" style={{ minHeight: 88 }}>
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>{activeProducts}</p>
          <p className="app-row-meta">Active products</p>
        </Link>
      </div>

      <Link to="/vendor/analytics" className="app-card app-card--pressable app-card--honeydew" style={{ marginBottom: '1.5rem', display: 'block' }}>
        <p className="app-row-title">Analytics</p>
        <p className="app-row-meta">Revenue, units sold, and order trends</p>
      </Link>

      <div className="app-list">
        <Link to="/vendor/fulfillment" className="app-card app-card--pressable app-card--honeydew">
          <p className="app-row-title">Fulfillment ledger</p>
          <p className="app-row-meta">Mark pickups complete and track live counters</p>
        </Link>
        <Link to="/vendor/products/new" className="app-card app-card--pressable">+ Add a product</Link>
        <Link to="/vendor/events" className="app-card app-card--pressable">My events</Link>
        <Link to="/vendor/posts/new" className="app-card app-card--pressable">+ Create a post</Link>
        <Link to="/vendor/leftovers" className="app-card app-card--pressable app-card--honeydew">
          <p className="app-row-title">List leftovers</p>
          <p className="app-row-meta">Post unsold items after market days</p>
        </Link>
        <Link to="/vendor/sales/manual" className="app-card app-card--pressable">Log in-person sale</Link>
        <Link to="/vendor/pos" className="app-card app-card--pressable">Connect Square POS</Link>
        <Link to="/vendor/storefront" className="app-card app-card--pressable">Edit storefront</Link>
        <Link to="/vendor/explore" className="app-card app-card--pressable">
          <p className="app-row-title">Explore showcase</p>
          <p className="app-row-meta">Publish portfolio posts to the customer Explore feed</p>
        </Link>
        <Link to="/vendor/compliance" className="app-card app-card--pressable">
          <p className="app-row-title">Food safety checklist</p>
          <p className="app-row-meta">State cottage food requirements and compliance status</p>
        </Link>
        <Link to="/vendor/credentials" className="app-card app-card--pressable">
          <p className="app-row-title">Verification credentials</p>
          <p className="app-row-meta">Upload documents to earn trust badges</p>
        </Link>
      </div>
    </div>
  );
}
