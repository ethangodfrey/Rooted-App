import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import type { Chef } from '@/types/database';
import '@/components/ui/ui.css';

export function ShopperChefsPage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('chefs')
        .select('*')
        .eq('approval_status', 'approved')
        .order('featured', { ascending: false })
        .order('display_name', { ascending: true });
      setChefs((data ?? []) as Chef[]);
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Vendorly</p>
      <h1 className="app-title">Private chefs near you</h1>
      <p className="app-subtitle">
        Book private dining, meal prep, and catering from local chefs.
      </p>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : chefs.length === 0 ? (
        <p className="app-empty">No chefs listed yet.</p>
      ) : (
        <div className="app-list">
          {chefs.map((chef) => (
            <Link
              key={chef.id}
              to={`/shopper/chefs/${chef.id}`}
              className="app-card app-card--pressable app-row"
            >
              {chef.profile_photo_url ? (
                <img
                  src={chef.profile_photo_url}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }}
                />
              ) : (
                <div className="app-row-icon">👨‍🍳</div>
              )}
              <div className="app-row-body">
                <p className="app-row-title">
                  {chef.display_name}
                  {chef.featured ? ' ⭐' : ''}
                </p>
                <p className="app-row-meta">
                  {[chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ') ||
                    'Private chef'}
                  {chef.cuisine_specialties?.length
                    ? ` · ${chef.cuisine_specialties.slice(0, 3).join(', ')}`
                    : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
