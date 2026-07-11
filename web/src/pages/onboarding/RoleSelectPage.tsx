import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { ensureRoleExtension, type OnboardingRole } from '@/lib/role-selection';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const ROLE_OPTIONS: { role: OnboardingRole; title: string; meta: string }[] = [
  {
    role: 'shopper',
    title: 'Customer',
    meta: 'Discover markets, browse vendors and chefs, and reserve items for pickup.',
  },
  {
    role: 'vendor',
    title: 'Vendor',
    meta: 'Manage your storefront, inventory, orders, and event presence.',
  },
  {
    role: 'chef',
    title: 'Private chef',
    meta: 'List your services, respond to booking inquiries, and showcase your work.',
  },
];

export function RoleSelectPage() {
  const navigate = useNavigate();
  const { session, user, refreshUser, signOut } = useAuth();
  const [loading, setLoading] = useState<OnboardingRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user?.role) {
    return <Navigate to="/app" replace />;
  }

  async function selectRole(role: OnboardingRole) {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setLoading(role);
    setError(null);

    const userId = session.user.id;

    const { error: roleError } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (roleError) {
      setLoading(null);
      setError(roleError.message);
      return;
    }

    const { error: extensionError } = await ensureRoleExtension(userId, role);

    if (extensionError) {
      setLoading(null);
      setError(extensionError);
      return;
    }

    await refreshUser();
    setLoading(null);
    navigate('/app');
  }

  return (
    <div className="app-screen app-screen--narrow">
      <button type="button" className="app-back-link" onClick={signOut}>
        ← Sign out
      </button>

      <p className="app-eyebrow">Vendorly</p>
      <h1 className="app-title">How will you use Vendorly?</h1>
      <p className="app-subtitle">Choose your role to personalize your experience.</p>

      <div className="app-list">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.role}
            type="button"
            className="app-card app-card--pressable"
            onClick={() => selectRole(option.role)}
            disabled={loading !== null}
          >
            {loading === option.role ? (
              <div className="app-spinner" />
            ) : (
              <>
                <h3 className="app-row-title">{option.title}</h3>
                <p className="app-row-meta">{option.meta}</p>
              </>
            )}
          </button>
        ))}
      </div>

      {error ? <p className="app-error">{error}</p> : null}
    </div>
  );
}
