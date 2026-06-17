import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { ensureRoleExtension } from '@/lib/role-selection';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function RoleSelectPage() {
  const navigate = useNavigate();
  const { session, user, refreshUser, signOut } = useAuth();
  const [loading, setLoading] = useState<'shopper' | 'vendor' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user?.role) {
    return <Navigate to="/app" replace />;
  }

  async function selectRole(role: 'shopper' | 'vendor') {
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

      <p className="app-eyebrow">Rooted</p>
      <h1 className="app-title">How will you use Rooted?</h1>
      <p className="app-subtitle">
        Choose your role to personalize your experience.
      </p>

      <div className="app-list">
        <button
          type="button"
          className="app-card app-card--pressable"
          onClick={() => selectRole('shopper')}
          disabled={loading !== null}
        >
          {loading === 'shopper' ? (
            <div className="app-spinner" />
          ) : (
            <>
              <h3 className="app-row-title">Shopper</h3>
              <p className="app-row-meta">
                Discover events, follow vendors, and reserve items for pickup.
              </p>
            </>
          )}
        </button>

        <button
          type="button"
          className="app-card app-card--pressable"
          onClick={() => selectRole('vendor')}
          disabled={loading !== null}
        >
          {loading === 'vendor' ? (
            <div className="app-spinner" />
          ) : (
            <>
              <h3 className="app-row-title">Vendor</h3>
              <p className="app-row-meta">
                Manage your storefront, inventory, orders, and event presence.
              </p>
            </>
          )}
        </button>
      </div>

      {error ? <p className="app-error">{error}</p> : null}
    </div>
  );
}
