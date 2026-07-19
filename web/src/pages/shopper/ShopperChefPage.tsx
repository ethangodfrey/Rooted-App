import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { TrustBadges } from '@/components/trust/TrustBadges';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { useSavedItems } from '@/hooks/use-saved-items';
import { CHEF_SERVICE_TYPE_LABEL, formatServicePrice } from '@/lib/chefs';
import { supabase } from '@/lib/supabase';
import type { Chef, ChefService } from '@/types/database';
import '@/components/ui/ui.css';

function ChefPageSkeleton() {
  return (
    <div className="app-screen flex flex-col gap-4" aria-busy aria-label="Loading chef profile">
      <Skeleton className="h-40 w-full rounded-2xl sm:h-48" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonText width="50%" height={24} />
          <SkeletonText width="35%" height={14} />
        </div>
      </div>
      <SkeletonCard height={120} />
    </div>
  );
}

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

  if (loading) return <ChefPageSkeleton />;
  if (!chef) return <div className="app-empty">Chef not found.</div>;

  const saved = isSaved('chef', id!);

  return (
    <div className="app-screen min-w-0">
      <div className="app-page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/shopper/chefs" className="app-back-link">
          ← Back
        </Link>
        <button
          type="button"
          className="app-btn app-btn--secondary app-btn--small self-start sm:self-auto"
          disabled={pending}
          onClick={() => toggle({ itemType: 'chef', itemId: id! })}
        >
          {saved ? '♥ Saved' : '♡ Save chef'}
        </button>
      </div>

      <FallbackImage
        src={chef.banner_url}
        variant="banner"
        category="Wellness"
        label={chef.display_name}
        className="mb-4 h-40 w-full max-h-[200px] rounded-2xl object-cover sm:h-48"
      />

      <div className="app-row mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <FallbackImage
          src={chef.profile_photo_url}
          variant="avatar"
          label={chef.display_name}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0">
          <h1 className="app-title m-0 truncate">{chef.display_name}</h1>
          <p className="app-row-meta">
            {[chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ')}
          </p>
          <TrustBadges userId={chef.user_id} />
        </div>
      </div>

      {chef.cuisine_specialties?.length ? (
        <div className="app-chip-row flex flex-wrap gap-2">
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
              <div className="app-row-body min-w-0">
                <p className="app-row-title">{service.service_name}</p>
                <p className="app-row-meta">
                  {CHEF_SERVICE_TYPE_LABEL[service.service_type]} ·{' '}
                  {formatServicePrice(service.base_price, service.price_type)}
                </p>
              </div>
              <span className="map-event-action shrink-0">Request →</span>
            </Link>
          ))}
        </div>
      )}

      <ReviewsSection targetType="chef" targetId={id!} />
    </div>
  );
}
