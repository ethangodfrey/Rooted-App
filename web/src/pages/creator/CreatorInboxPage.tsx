import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { SpecialtyPills } from '@/components/ui/SpecialtyPills';
import { UserSticker } from '@/components/ui/UserSticker';
import { useAuth } from '@/hooks/use-auth';
import {
  listVendorShopperThreads,
  type InboxThreadRow,
} from '@/lib/chat-order-context';
import {
  acceptNetworkConnection,
  fetchConnectedNetworkRows,
  fetchPendingNetworkRequests,
  ignoreNetworkConnection,
  type NetworkConnectionRow,
} from '@/lib/network-connections';
import { supabase } from '@/lib/supabase';
import type { ProfileRole } from '@/types/profiles';
import '@/components/ui/ui.css';
import '@/components/ui/user-sticker.css';

type InboxTab = 'chats' | 'requests';

type PeerMeta = {
  profileId: string;
  displayName: string;
  role: ProfileRole | null;
  specialties: string[];
};

async function loadPeerMeta(profileIds: string[]): Promise<Record<string, PeerMeta>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, vendor_specialties, farmer_specialties')
    .in('id', unique);

  const { data: vendors } = await supabase
    .from('vendors')
    .select('user_id, business_name')
    .in('user_id', unique);

  const { data: farmers } = await supabase
    .from('farmers')
    .select('user_id, farm_name')
    .in('user_id', unique);

  const vendorName = new Map(
    (vendors ?? []).map((v) => [v.user_id as string, v.business_name as string | null]),
  );
  const farmerName = new Map(
    (farmers ?? []).map((f) => [f.user_id as string, f.farm_name as string | null]),
  );

  const out: Record<string, PeerMeta> = {};
  for (const p of profiles ?? []) {
    const id = p.id as string;
    const role = (p.role as ProfileRole | null) ?? null;
    const vendorSpecs = (p.vendor_specialties as string[] | null) ?? [];
    const farmerSpecs = (p.farmer_specialties as string[] | null) ?? [];
    out[id] = {
      profileId: id,
      role,
      displayName:
        vendorName.get(id) ||
        farmerName.get(id) ||
        (role === 'farmer' ? 'Farmer' : 'Creator peer'),
      specialties: role === 'farmer' ? farmerSpecs : vendorSpecs,
    };
  }
  return out;
}

/**
 * Creator-shell inbox — shopper order threads + B2B requests with
 * creator-prefixed navigation (not a vendor inbox re-export).
 */
export function CreatorInboxPage() {
  const { user, vendor } = useAuth();
  const profileId = user?.id ?? null;
  const authVendorId = vendor?.id ?? null;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: InboxTab = params.get('tab') === 'requests' ? 'requests' : 'chats';

  const [pending, setPending] = useState<NetworkConnectionRow[]>([]);
  const [connected, setConnected] = useState<NetworkConnectionRow[]>([]);
  const [preorderThreads, setPreorderThreads] = useState<InboxThreadRow[]>([]);
  const [shopperLabels, setShopperLabels] = useState<Record<string, string>>({});
  const [peerMeta, setPeerMeta] = useState<Record<string, PeerMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('CREATOR_FORKS_DEEPENED SURFACE=INBOX');
  }, []);

  function setTab(next: InboxTab) {
    setParams(next === 'requests' ? { tab: 'requests' } : {});
  }

  useEffect(() => {
    let active = true;
    if (!profileId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        let rowId = authVendorId;
        if (!rowId) {
          const { data: vendorRow } = await supabase
            .from('vendors')
            .select('id')
            .eq('user_id', profileId)
            .maybeSingle();
          rowId = (vendorRow?.id as string | null) ?? null;
        }

        const [reqRows, connRows, shopperThreads] = await Promise.all([
          fetchPendingNetworkRequests(profileId),
          fetchConnectedNetworkRows(profileId),
          rowId ? listVendorShopperThreads(rowId) : Promise.resolve([] as InboxThreadRow[]),
        ]);
        if (!active) return;
        setPending(reqRows);
        setConnected(connRows);
        setPreorderThreads(shopperThreads);

        const ids = [
          ...reqRows.map((r) => r.sender_id),
          ...connRows.map((r) => (r.sender_id === profileId ? r.receiver_id : r.sender_id)),
        ];
        const meta = await loadPeerMeta(ids);
        if (!active) return;
        setPeerMeta(meta);

        const shopperIds = [...new Set(shopperThreads.map((t) => t.customer_user_id))];
        if (shopperIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', shopperIds);
          if (!active) return;
          const labels: Record<string, string> = {};
          for (const u of users ?? []) {
            labels[u.id as string] =
              (u.name as string | null) || (u.email as string | null) || 'Shopper';
          }
          setShopperLabels(labels);
        }

        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load inbox');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [profileId, authVendorId]);

  const chatRows = useMemo(() => {
    if (!profileId) return [];
    return connected.map((row) => {
      const peerId = row.sender_id === profileId ? row.receiver_id : row.sender_id;
      return { row, peerId, meta: peerMeta[peerId] };
    });
  }, [connected, peerMeta, profileId]);

  async function accept(senderId: string) {
    if (!profileId) return;
    setBusyId(senderId);
    try {
      await acceptNetworkConnection(profileId, senderId);
      setPending((prev) => prev.filter((r) => r.sender_id !== senderId));
      const refreshed = await fetchConnectedNetworkRows(profileId);
      setConnected(refreshed);
      const ids = refreshed.map((r) => (r.sender_id === profileId ? r.receiver_id : r.sender_id));
      setPeerMeta(await loadPeerMeta([...ids, senderId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept');
    } finally {
      setBusyId(null);
    }
  }

  async function ignore(senderId: string) {
    if (!profileId) return;
    setBusyId(senderId);
    try {
      await ignoreNetworkConnection(profileId, senderId);
      setPending((prev) => prev.filter((r) => r.sender_id !== senderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to ignore');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-screen app-screen--narrow">
      <p className="app-eyebrow">Creator workspace</p>
      <h1 className="app-title">Creator inbox</h1>
      <p className="app-subtitle">
        Shopper order chats and creator-network collaboration requests — kept on the creator shell.
      </p>

      <div className="mb-5 flex gap-2 border-b border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setTab('chats')}
          className="rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{
            border: tab === 'chats' ? '1px solid rgba(129,140,248,0.7)' : '1px solid transparent',
            color: tab === 'chats' ? '#c7d2fe' : '#71717a',
            background: tab === 'chats' ? 'rgba(99,102,241,0.15)' : 'transparent',
          }}
        >
          CHATS
        </button>
        <button
          type="button"
          onClick={() => setTab('requests')}
          className="rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{
            border: tab === 'requests' ? '1px solid rgba(129,140,248,0.7)' : '1px solid transparent',
            color: tab === 'requests' ? '#c7d2fe' : '#71717a',
            background: tab === 'requests' ? 'rgba(99,102,241,0.15)' : 'transparent',
          }}
        >
          NETWORK REQUESTS
          {pending.length > 0 ? ` (${pending.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : tab === 'chats' ? (
        chatRows.length === 0 && preorderThreads.length === 0 ? (
          <div className="app-empty" style={{ textAlign: 'left' }}>
            <p style={{ margin: '0 0 0.75rem' }}>No creator conversations yet.</p>
            <p className="app-row-meta" style={{ margin: 0 }}>
              Shopper order threads and creator-network chats appear here.
            </p>
            <Link to="/creator/network" className="app-btn app-btn--primary mt-4 inline-flex">
              Open creator network
            </Link>
          </div>
        ) : (
          <div>
            {preorderThreads.length > 0 ? (
              <>
                <p className="app-row-meta mb-2 font-mono tracking-wide">ORDER_CONTEXT THREADS</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem' }}>
                  {preorderThreads.map((thread) => (
                    <li key={thread.id} className="app-card" style={{ marginBottom: '0.75rem' }}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="app-row-title" style={{ margin: 0 }}>
                            {shopperLabels[thread.customer_user_id] ?? 'Shopper'}
                          </p>
                          <p
                            className="app-row-meta"
                            style={{ margin: '0.25rem 0 0', fontFamily: 'monospace' }}
                          >
                            {thread.associated_order_id ? 'ORDER_CONTEXT' : 'SHOPPER THREAD'}
                            {thread.subject ? ` · ${thread.subject}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
                          onClick={() => navigate(`/creator/inbox/thread/${thread.id}`)}
                        >
                          [ OPEN ]
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {chatRows.length > 0 ? (
              <>
                <p className="app-row-meta mb-2 font-mono tracking-wide">CREATOR NETWORK</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {chatRows.map(({ peerId, meta }) => (
                    <li key={peerId} className="app-card" style={{ marginBottom: '0.75rem' }}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="user-sticker-row">
                            <p className="app-row-title" style={{ margin: 0 }}>
                              {meta?.displayName ?? 'Network peer'}
                            </p>
                            <UserSticker role={meta?.role} />
                          </div>
                          <p className="app-row-meta">Creator network chat</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200"
                          onClick={() => navigate(`/creator/inbox/chat/${peerId}`)}
                        >
                          [ MESSAGE ]
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )
      ) : pending.length === 0 ? (
        <div className="app-empty">No pending creator-network requests.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {pending.map((row) => {
            const meta = peerMeta[row.sender_id];
            return (
              <li key={row.id} className="app-card" style={{ marginBottom: '0.75rem' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="user-sticker-row">
                      <p className="app-row-title" style={{ margin: 0 }}>
                        {meta?.displayName ?? 'Network peer'}
                      </p>
                      <UserSticker role={meta?.role} />
                    </div>
                    <SpecialtyPills
                      specialties={meta?.specialties}
                      style={{ marginTop: '0.35rem', marginBottom: '0.25rem' }}
                    />
                    <p className="app-row-meta">PENDING creator-network request</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.sender_id}
                      className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200"
                      onClick={() => void accept(row.sender_id)}
                    >
                      [ ACCEPT ]
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.sender_id}
                      className="rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400"
                      onClick={() => void ignore(row.sender_id)}
                    >
                      [ IGNORE ]
                    </button>
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
