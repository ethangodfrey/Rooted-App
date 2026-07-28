import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ConnectionButton,
  connectionUiToButtonProps,
} from '@/components/ui/ConnectionButton';
import { SpecialtyPills } from '@/components/ui/SpecialtyPills';
import { UserSticker } from '@/components/ui/UserSticker';
import { useAuth } from '@/hooks/use-auth';
import {
  FARMER_SPECIALTIES,
  SPECIALTY_FILTER_LABELS,
  VENDOR_SPECIALTIES,
  type SpecialtyTag,
} from '@/lib/specialties';
import {
  fetchLocalNetworkPeers,
  fetchNetworkConnection,
  type NetworkConnectionUi,
  type NetworkPeer,
} from '@/lib/network-connections';
import '@/components/ui/ui.css';
import '@/components/ui/user-sticker.css';

type PeerState = Record<string, NetworkConnectionUi>;

/**
 * Creator-shell V2V network — distinct copy and /creator routes
 * (not a vendor storefront re-export).
 */
export function CreatorNetworkPage() {
  const { user, vendor } = useAuth();
  const profileId = user?.id ?? null;
  const [peers, setPeers] = useState<NetworkPeer[]>([]);
  const [states, setStates] = useState<PeerState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyTag | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'vendor' | 'farmer'>('all');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('CREATOR_FORKS_DEEPENED SURFACE=NETWORK');
  }, []);

  useEffect(() => {
    let active = true;
    if (!profileId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const rows = await fetchLocalNetworkPeers({
          currentProfileId: profileId,
          postalCode: vendor?.postal_code,
          roleFilter,
          specialtyFilters: specialtyFilter ? [specialtyFilter] : [],
        });
        if (!active) return;
        setPeers(rows);

        const entries = await Promise.all(
          rows.map(async (row) => {
            const view = await fetchNetworkConnection(profileId, row.profileId);
            return [row.profileId, view.uiState] as const;
          }),
        );
        if (!active) return;
        setStates(Object.fromEntries(entries));
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load network');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [profileId, vendor?.postal_code, roleFilter, specialtyFilter]);

  const filterOptions = useMemo(() => {
    if (roleFilter === 'farmer') return [...FARMER_SPECIALTIES];
    if (roleFilter === 'vendor') return [...VENDOR_SPECIALTIES];
    return [...VENDOR_SPECIALTIES, ...FARMER_SPECIALTIES];
  }, [roleFilter]);

  return (
    <div className="app-screen app-screen--narrow">
      <p className="app-eyebrow">Creator workspace</p>
      <h1 className="app-title">Creator network</h1>
      <p className="app-subtitle">
        Collaborate with makers and growers near {vendor?.postal_code?.trim() || 'your area'} —
        source ingredients, co-list drops, and grow your creator circle.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/creator/inbox" className="app-btn app-btn--primary app-btn--small">
          Creator inbox
        </Link>
        <Link to="/creator/listings" className="app-btn app-btn--secondary app-btn--small">
          Your listings
        </Link>
        <Link to="/onboarding/specialties" className="app-btn app-btn--secondary app-btn--small">
          Edit specialties
        </Link>
      </div>

      <section className="mb-4">
        <p className="app-eyebrow" style={{ marginBottom: '0.5rem' }}>
          Directory filters
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          {(['all', 'vendor', 'farmer'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className="app-btn app-btn--small"
              style={{
                borderColor: roleFilter === r ? 'rgba(129,140,248,0.7)' : undefined,
                background: roleFilter === r ? 'rgba(99,102,241,0.2)' : undefined,
              }}
              onClick={() => {
                setRoleFilter(r);
                setSpecialtyFilter(null);
              }}
            >
              {r === 'all' ? 'ALL' : r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400"
            style={{
              borderColor: !specialtyFilter ? 'rgba(129,140,248,0.7)' : '#27272a',
              color: !specialtyFilter ? '#c7d2fe' : '#a1a1aa',
            }}
            onClick={() => setSpecialtyFilter(null)}
          >
            Any specialty
          </button>
          {filterOptions.map((tag) => {
            const active = specialtyFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400"
                style={{
                  borderColor: active ? 'rgba(129,140,248,0.7)' : '#27272a',
                  color: active ? '#c7d2fe' : '#a1a1aa',
                  background: active ? 'rgba(99,102,241,0.2)' : 'rgba(9, 9, 11, 0.8)',
                }}
                onClick={() => setSpecialtyFilter(active ? null : tag)}
              >
                {SPECIALTY_FILTER_LABELS[tag]}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : peers.length === 0 ? (
        <div className="app-empty">No nearby creator-network matches for this filter.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {peers.map((peer) => {
            const ui = states[peer.profileId] ?? 'none';
            const place = [peer.sellCity, peer.sellState, peer.postalCode]
              .filter(Boolean)
              .join(', ');
            const href = peer.vendorId ? `/vendors/${peer.vendorId}` : '/creator/network';
            return (
              <li key={peer.profileId} className="app-card" style={{ marginBottom: '0.75rem' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="user-sticker-row" style={{ marginBottom: '0.25rem' }}>
                      {peer.vendorId ? (
                        <Link
                          to={href}
                          className="app-row-title"
                          style={{ textDecoration: 'none', margin: 0 }}
                        >
                          {peer.displayName ?? 'Peer'}
                        </Link>
                      ) : (
                        <p className="app-row-title" style={{ margin: 0 }}>
                          {peer.displayName ?? 'Farmer'}
                        </p>
                      )}
                      <UserSticker role={peer.role} />
                    </div>
                    <SpecialtyPills specialties={peer.specialties} style={{ marginBottom: '0.35rem' }} />
                    <p className="app-row-meta">
                      {[peer.category, place].filter(Boolean).join(' · ') ||
                        peer.productSummary ||
                        'Creator network peer'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ConnectionButton
                      targetProfileId={peer.profileId}
                      {...connectionUiToButtonProps(ui)}
                      onStatusChange={(next) => {
                        setStates((prev) => ({ ...prev, [peer.profileId]: next }));
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
