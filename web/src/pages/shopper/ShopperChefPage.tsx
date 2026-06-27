import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrustBadges } from '@/components/trust/TrustBadges';
import { useSavedItems } from '@/hooks/use-saved-items';
import { CHEF_SERVICE_TYPE_LABEL, formatServicePrice } from '@/lib/chefs';
import { supabase } from '@/lib/supabase';
import type { Chef, ChefService } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperChefPage() {
  const { id } = useParams<{ id: string }>();
  const { isSaved, toggle, pending } = useSavedItems();
  const [chef, setChef] = useState<Chef | null>(null);
  const [services, setServices] = useState<ChefService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [chefRes, servicesRes] = await Promise.all([
        supabase.from('chefs').select('*').eq('id', id).maybeSingle(),
        supabase.from('chef_services').select('*').eq('chef_id', id).eq('active', true),
      ]);
      setChef(chefRes.data);
      setServices((servicesRes.data ?? []) as ChefService[]);
      setLoading(false);
    }
    void load();
  }, [id]);

  if (loading)
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  if (!chef) return <div className="app-empty">Chef not found.</div>;

  const saved = isSaved('chef', id!);

  return (
    <div className="app-screen">
      <div className="app-page-header">
        <Link to="/shopper/chefs" className="app-back-link">
          ← Back
        </Link>
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small"
          disabled={pending}
          onClick={() => toggle({ itemType: 'chef', itemId: id! })}
        >
          {saved ? '♥ Saved' : '♡ Save chef'}
        </button>
      </div>

      {chef.banner_url ? (
        <img
          src={chef.banner_url}
          alt=""
          style={{
            width: '100%',
            borderRadius: '16px',
            marginBottom: '1rem',
            maxHeight: '200px',
            objectFit: 'cover',
          }}
        />
      ) : null}

      <div className="app-row" style={{ marginBottom: '1rem' }}>
        {chef.profile_photo_url ? (
          <img
            src={chef.profile_photo_url}
            alt=""
            style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }}
          />
        ) : (
          <div className="app-row-icon">👨‍🍳</div>
        )}
        <div>
          <h1 className="app-title" style={{ margin: 0 }}>
            {chef.display_name}
          </h1>
          <p className="app-row-meta">
            {[chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ')}
          </p>
          <TrustBadges userId={chef.user_id} />
        </div>
      </div>

      {chef.cuisine_specialties?.length ? (
        <div className="app-chip-row">
          {chef.cuisine_specialties.map((c) => (
            <span key={c} className="app-chip">
              {c}
            </span>
          ))}
        </div>
      ) : null}

      {chef.bio ? <p className="app-subtitle">{chef.bio}</p> : null}

      <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.75rem' }}>Services</h2>
      {services.length === 0 ? (
        <p className="app-row-meta">No services listed yet.</p>
      ) : (
        <div className="app-list">
          {services.map((service) => (
            <Link
              key={service.id}
              to={`/shopper/chefs/book/${service.id}`}
              className="app-card app-card--pressable app-row"
            >
              <div className="app-row-body">
                <p className="app-row-title">{service.service_name}</p>
                <p className="app-row-meta">
                  {CHEF_SERVICE_TYPE_LABEL[service.service_type]} ·{' '}
                  {formatServicePrice(service.base_price, service.price_type)}
                </p>
              </div>
              <span className="map-event-action">Request →</span>
            </Link>
          ))}
        </div>
      )}

      <ReviewsSection targetType="chef" targetId={id!} />
    </div>
  );
}
