import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const statusCopy: Record<string, string> = {
  pending: 'Your vendor account is pending admin approval.',
  approved: 'Your storefront is live and visible to shoppers.',
  rejected: 'Your vendor application was not approved. Contact support.',
};

export function VendorDashboardPage() {
  const { user, vendor } = useAuth();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);

  useEffect(() => {
    async function load() {
      if (!vendor) return;
      const [ordersRes, productsRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id).in('order_status', ['submitted', 'pending_review']),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id).eq('status', 'active'),
      ]);
      setPendingOrders(ordersRes.count ?? 0);
      setActiveProducts(productsRes.count ?? 0);
    }
    load();
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/vendor/orders" className="app-card app-card--pressable">
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>{pendingOrders}</p>
          <p className="app-row-meta">Pending orders</p>
        </Link>
        <Link to="/vendor/products" className="app-card app-card--pressable">
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>{activeProducts}</p>
          <p className="app-row-meta">Active products</p>
        </Link>
      </div>

      <Link to="/vendor/analytics" className="app-card app-card--pressable app-card--honeydew" style={{ marginBottom: '1.5rem', display: 'block' }}>
        <p className="app-row-title">Analytics</p>
        <p className="app-row-meta">Revenue, units sold, and order trends</p>
      </Link>

      <div className="app-list">
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
      </div>
    </div>
  );
}
