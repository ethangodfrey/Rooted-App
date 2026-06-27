import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { isCustomerRole } from '@/lib/role-utils';
import { resetRoleSelection } from '@/lib/reset-role-selection';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const INTEREST_OPTIONS = [
  'Food & Drink',
  'Baked Goods',
  'Art & Prints',
  'Jewelry',
  'Apparel',
  'Home & Decor',
  'Plants',
  'Candles & Soap',
  'Vintage & Thrift',
  'Handmade Crafts',
  'Wellness',
  'Pet Goods',
];

export function InterestsPage() {
  const navigate = useNavigate();
  const { session, user, refreshUser } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.role && !isCustomerRole(user.role)) {
    return <Navigate to="/app" replace />;
  }

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((i) => i !== option) : [...prev, option],
    );
  }

  async function handleContinue() {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }
    if (selected.length === 0) {
      setError('Pick at least one interest to personalize your feed.');
      return;
    }

    setLoading(true);
    setError(null);

    const userId = session.user.id;

    const { error: userError } = await supabase
      .from('users')
      .update({
        city: city.trim() || null,
        zip_code: zip.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      setLoading(false);
      setError(userError.message);
      return;
    }

    const { error: shopperError } = await supabase
      .from('shoppers')
      .update({
        interests: selected,
        default_location: city.trim() || zip.trim() || null,
      })
      .eq('user_id', userId);

    if (shopperError) {
      setLoading(false);
      setError(shopperError.message);
      return;
    }

    await refreshUser();
    setLoading(false);
    navigate('/app');
  }

  async function handleBack() {
    if (!session?.user) return;
    setBacking(true);
    const { error: resetError } = await resetRoleSelection(session.user.id, 'shopper');
    setBacking(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    await refreshUser();
    navigate('/onboarding/role-select');
  }

  return (
    <div className="app-screen app-screen--narrow">
      <button type="button" className="app-back-link" onClick={handleBack} disabled={loading || backing}>
        ← Back
      </button>

      <p className="app-eyebrow">Step 2 of 2</p>
      <h1 className="app-title">What are you into?</h1>
      <p className="app-subtitle">
        Pick a few interests so we can surface vendors and events you'll love.
      </p>

      <div className="app-chip-row">
        {INTEREST_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`app-chip${selected.includes(option) ? ' app-chip--selected' : ''}`}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
        Where do you shop? <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(optional)</span>
      </h2>
      <div className="app-input-group">
        <label htmlFor="city">City</label>
        <input id="city" className="app-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
      </div>
      <div className="app-input-group">
        <label htmlFor="zip">ZIP code</label>
        <input id="zip" className="app-input" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="78701" />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button type="button" className="app-btn app-btn--primary" disabled={loading || backing} onClick={handleContinue}>
        {loading ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
