import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { SpecialtyPills } from '@/components/ui/SpecialtyPills';
import { UserSticker } from '@/components/ui/UserSticker';
import { useAuth } from '@/hooks/use-auth';
import {
  normalizeSpecialtySelection,
  specialtiesForRole,
  type SpecialtyTag,
} from '@/lib/specialties';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

/**
 * Post-role specialty picker for vendor | farmer.
 * Routes: /onboarding/specialties
 */
export function SpecialtiesPage() {
  const navigate = useNavigate();
  const { session, user, refreshUser, signOut } = useAuth();
  const role = user?.role === 'farmer' || user?.role === 'vendor' ? user.role : null;

  const [selected, setSelected] = useState<SpecialtyTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !role) return;
    const raw = role === 'farmer' ? user.farmer_specialties : user.vendor_specialties;
    setSelected(normalizeSpecialtySelection(role, raw ?? []));
  }, [user, role]);

  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  if (user && !role) {
    return <Navigate to="/app" replace />;
  }

  if (!role) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  const options = specialtiesForRole(role);

  function toggle(tag: SpecialtyTag) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleContinue() {
    if (selected.length === 0) {
      setError('Pick at least one specialty.');
      return;
    }

    setLoading(true);
    setError(null);

    const userId = session!.user.id;
    const payload =
      role === 'farmer'
        ? { farmer_specialties: selected, vendor_specialties: [] as string[] }
        : { vendor_specialties: selected, farmer_specialties: [] as string[] };

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        role,
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      const { error: userError } = await supabase
        .from('users')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (userError) {
        setLoading(false);
        setError(profileError.message || userError.message);
        return;
      }
    }

    await refreshUser();
    setLoading(false);
    navigate('/app');
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.18), transparent 55%), radial-gradient(900px 500px at 90% 10%, rgba(34,197,94,0.12), transparent 50%), #0B1228',
        color: '#e2e8f0',
      }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={signOut}
          className="mb-8 text-sm font-medium text-slate-400 transition hover:text-orange-300"
        >
          Sign out
        </button>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <UserSticker role={role} />
          <SpecialtyPills specialties={selected} />
        </div>

        <h1 className="m-0 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Your specialties
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Select the categories that describe what you offer. These appear as text tags on your
          profile and help nearby businesses find you.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((tag) => {
            const active = selected.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] transition"
                style={{
                  borderColor: active ? 'rgba(129, 140, 248, 0.85)' : 'rgba(71, 85, 105, 0.7)',
                  background: active ? 'rgba(99, 102, 241, 0.28)' : 'rgba(15, 23, 42, 0.55)',
                  color: active ? '#e0e7ff' : '#94a3b8',
                  boxShadow: active ? 'inset 0 0 0 1px rgba(165, 180, 252, 0.35)' : undefined,
                }}
                aria-pressed={active}
              >
                <span>{tag}</span>
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: active ? 'none' : '1px solid rgba(148,163,184,0.5)',
                    background: active ? '#818cf8' : 'transparent',
                  }}
                />
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-6 text-sm font-medium text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={loading}
          onClick={() => void handleContinue()}
          className="mt-8 w-full rounded-xl border border-orange-500/40 bg-orange-500/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-orange-200 transition hover:bg-orange-500/25 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
