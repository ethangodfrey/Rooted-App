import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const statusCopy: Record<string, string> = {
  pending: 'Your chef profile is pending admin review.',
  approved: 'Your chef profile is live and visible to customers.',
  rejected: 'Your chef profile was not approved. Contact support.',
};

export function ChefDashboardPage() {
  const { chef } = useAuth();
  const [openInquiries, setOpenInquiries] = useState(0);
  const [activeServices, setActiveServices] = useState(0);

  useEffect(() => {
    async function load() {
      if (!chef?.id) return;
      const [bookingsRes, servicesRes] = await Promise.all([
        supabase
          .from('chef_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('chef_id', chef.id)
          .in('booking_status', ['inquiry', 'pending_review']),
        supabase
          .from('chef_services')
          .select('id', { count: 'exact', head: true })
          .eq('chef_id', chef.id)
          .eq('active', true),
      ]);
      setOpenInquiries(bookingsRes.count ?? 0);
      setActiveServices(servicesRes.count ?? 0);
    }
    void load();
  }, [chef?.id]);

  const status = chef?.approval_status ?? 'pending';

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Chef</p>
      <h1 className="app-title">Welcome, {chef?.display_name ?? 'Chef'}</h1>
      <p className="app-subtitle">
        Manage services, respond to booking inquiries, and showcase your work.
      </p>

      <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
        <p className="app-row-meta">Approval status</p>
        <p className="app-row-title" style={{ textTransform: 'capitalize' }}>
          {status}
        </p>
        <p className="app-row-meta">{statusCopy[status]}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <Link to="/chef/bookings" className="app-card app-card--pressable">
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            {openInquiries}
          </p>
          <p className="app-row-meta">Open inquiries</p>
        </Link>
        <Link to="/chef/services" className="app-card app-card--pressable">
          <p className="app-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            {activeServices}
          </p>
          <p className="app-row-meta">Active services</p>
        </Link>
      </div>

      <div className="app-list">
        <Link to="/chef/services/new" className="app-card app-card--pressable">
          + Add a service
        </Link>
        <Link to="/chef/portfolio" className="app-card app-card--pressable">
          <p className="app-row-title">Update portfolio</p>
          <p className="app-row-meta">Showcase dishes and past events on Explore</p>
        </Link>
        <Link to="/chef/credentials" className="app-card app-card--pressable">
          <p className="app-row-title">Verification credentials</p>
          <p className="app-row-meta">Upload documents to earn trust badges</p>
        </Link>
      </div>
    </div>
  );
}
