import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { CHEF_SERVICE_TYPE_LABEL, formatServicePrice } from '@/lib/chefs';
import { supabase } from '@/lib/supabase';
import type { ChefService } from '@/types/database';
import '@/components/ui/ui.css';

export function ChefServicesPage() {
  const { chef } = useAuth();
  const [services, setServices] = useState<ChefService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!chef?.id) {
      setServices([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('chef_services')
      .select('*')
      .eq('chef_id', chef.id)
      .order('created_at', { ascending: false });
    setServices((data ?? []) as ChefService[]);
    setLoading(false);
  }, [chef?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(service: ChefService) {
    await supabase
      .from('chef_services')
      .update({ active: !service.active })
      .eq('id', service.id);
    await load();
  }

  return (
    <div className="app-screen">
      <div className="app-page-header">
        <h1 className="app-title" style={{ margin: 0 }}>
          Your services
        </h1>
        <Link to="/chef/services/new" className="app-btn app-btn--secondary app-btn--small">
          + New service
        </Link>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : services.length === 0 ? (
        <p className="app-empty">No services yet. Add your first offering.</p>
      ) : (
        <div className="app-list">
          {services.map((service) => (
            <div key={service.id} className="app-card app-row saved-vendor-row">
              <div className="app-row-body">
                <p className="app-row-title">{service.service_name}</p>
                <p className="app-row-meta">
                  {CHEF_SERVICE_TYPE_LABEL[service.service_type]} ·{' '}
                  {formatServicePrice(service.base_price, service.price_type)}
                  {service.active ? '' : ' · Inactive'}
                </p>
              </div>
              <button
                type="button"
                className="app-btn app-btn--secondary app-btn--small"
                onClick={() => toggleActive(service)}
              >
                {service.active ? 'Hide' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
