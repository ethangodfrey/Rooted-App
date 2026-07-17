import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { UserSticker } from '@/components/ui/UserSticker';
import { useAuth } from '@/hooks/use-auth';
import { ensureRoleExtension, type StickerOnboardingRole } from '@/lib/role-selection';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

const ROLE_CARDS: {
  role: StickerOnboardingRole;
  title: string;
  meta: string;
  accent: 'shopper' | 'vendor' | 'farmer';
}[] = [
  {
    role: 'shopper',
    title: 'Shopper',
    meta: 'Explore local listings, follow vendors and farmers, and check out.',
    accent: 'shopper',
  },
  {
    role: 'vendor',
    title: 'Vendor',
    meta: 'List prepared products, post updates, run pre-orders, and connect B2B.',
    accent: 'vendor',
  },
  {
    role: 'farmer',
    title: 'Farmer',
    meta: 'List raw or bulk harvest goods, share daily updates, and supply vendors.',
    accent: 'farmer',
  },
];

/**
 * Dark split-card onboarding — permanent sticker role: shopper | vendor | farmer.
 * Route aliases: /onboarding/role-select · /onboarding/role
 */
export function RoleSelectPage() {
  const navigate = useNavigate();
  const { session, user, refreshUser, signOut } = useAuth();
  const [loading, setLoading] = useState<StickerOnboardingRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user?.role && loading === null) {
    return <Navigate to="/app" replace />;
  }

  async function selectRole(role: StickerOnboardingRole) {
    if (!session?.user) {
      setError('You must be signed in to continue.');
      return;
    }

    setLoading(role);
    setError(null);

    const userId = session.user.id;

    // Canonical sticker role lives on profiles (enum shopper|vendor|farmer); syncs to users.
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      // Fallback for environments that have not applied phase51 yet.
      const { error: roleError } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (roleError) {
        setLoading(null);
        setError(profileError.message || roleError.message);
        return;
      }
    }

    const { error: extensionError } = await ensureRoleExtension(userId, role);

    if (extensionError) {
      setLoading(null);
      setError(extensionError);
      return;
    }

    await refreshUser();
    setLoading(null);
    if (role === 'vendor' || role === 'farmer') {
      navigate('/onboarding/specialties');
      return;
    }
    navigate('/app');
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.22), transparent 55%), radial-gradient(900px 500px at 90% 10%, rgba(249,115,22,0.18), transparent 50%), #0B1228',
        color: '#e2e8f0',
      }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={signOut}
          className="mb-8 text-sm font-medium text-slate-400 transition hover:text-orange-300"
        >
          Sign out
        </button>

        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'rgba(251, 146, 60, 0.9)' }}
        >
          Rooted
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Who are you here as?
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Choose your permanent role badge. This sticker appears on your profile, storefront, and
          chats.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {ROLE_CARDS.map((card) => {
            const active = loading === card.role;
            const tone =
              card.accent === 'shopper'
                ? {
                    bg: 'linear-gradient(160deg, rgba(99,102,241,0.18), rgba(15,23,42,0.55))',
                    border: 'rgba(129, 140, 248, 0.35)',
                    label: '#a5b4fc',
                  }
                : card.accent === 'vendor'
                  ? {
                      bg: 'linear-gradient(160deg, rgba(249,115,22,0.18), rgba(15,23,42,0.55))',
                      border: 'rgba(251, 146, 60, 0.4)',
                      label: '#fdba74',
                    }
                  : {
                      bg: 'linear-gradient(160deg, rgba(34,197,94,0.18), rgba(15,23,42,0.55))',
                      border: 'rgba(74, 222, 128, 0.4)',
                      label: '#86efac',
                    };
            return (
              <button
                key={card.role}
                type="button"
                disabled={loading !== null}
                onClick={() => void selectRole(card.role)}
                className="group relative flex min-h-[220px] flex-col items-start rounded-2xl border p-6 text-left transition disabled:opacity-60"
                style={{
                  background: tone.bg,
                  borderColor: tone.border,
                  boxShadow: active
                    ? '0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.35)'
                    : '0 12px 32px rgba(0,0,0,0.25)',
                }}
              >
                <UserSticker role={card.role} />
                <h2 className="mt-5 m-0 text-xl font-semibold text-white">{card.title}</h2>
                <p className="mt-2 m-0 flex-1 text-sm leading-relaxed text-slate-300">{card.meta}</p>
                <span
                  className="mt-6 inline-flex items-center text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: tone.label }}
                >
                  {active ? 'Saving…' : 'Select'}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-6 text-sm font-medium text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
