import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { UserSticker } from '@/components/ui/UserSticker';
import { useAuth } from '@/hooks/use-auth';
import {
  acceptNetworkConnection,
  fetchLocalNetworkPeers,
  fetchNetworkConnection,
  sendNetworkConnectionRequest,
  type NetworkConnectionUi,
  type NetworkPeer,
} from '@/lib/network-connections';
import '@/components/ui/ui.css';
import '@/components/ui/user-sticker.css';

type PeerState = Record<string, NetworkConnectionUi>;

export function VendorNetworkPage() {
  const { user, vendor } = useAuth();
  const profileId = user?.id ?? null;
  const [peers, setPeers] = useState<NetworkPeer[]>([]);
  const [states, setStates] = useState<PeerState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
  }, [profileId, vendor?.postal_code]);

  async function connect(peerProfileId: string) {
    if (!profileId) return;
    setBusyId(peerProfileId);
    try {
      const view = await sendNetworkConnectionRequest(profileId, peerProfileId);
      setStates((prev) => ({ ...prev, [peerProfileId]: view.uiState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send request');
    } finally {
      setBusyId(null);
    }
  }

  async function accept(peerProfileId: string) {
    if (!profileId) return;
    setBusyId(peerProfileId);
    try {
      const view = await acceptNetworkConnection(profileId, peerProfileId);
      setStates((prev) => ({ ...prev, [peerProfileId]: view.uiState }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Vendor Network</h1>
      <p className="app-subtitle">
        Local vendors and farmers near {vendor?.postal_code?.trim() || 'your area'} — connect for
        sourcing and collaboration.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/vendor/map" className="app-btn app-btn--primary app-btn--small">
          Markets map
        </Link>
        <Link to="/explore/feed" className="app-btn app-btn--secondary app-btn--small">
          Shop the Explore feed
        </Link>
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : peers.length === 0 ? (
        <div className="app-empty">No nearby approved vendors or farmers found yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {peers.map((peer) => {
            const ui = states[peer.profileId] ?? 'none';
            const place = [peer.sellCity, peer.sellState, peer.postalCode]
              .filter(Boolean)
              .join(', ');
            const href = peer.vendorId ? `/vendors/${peer.vendorId}` : '/vendor/network';
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
                    <p className="app-row-meta">
                      {[peer.category, place].filter(Boolean).join(' · ') ||
                        peer.productSummary ||
                        'Local network peer'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {ui === 'none' ? (
                      <button
                        type="button"
                        className="app-btn app-btn--primary app-btn--small"
                        disabled={busyId === peer.profileId}
                        onClick={() => void connect(peer.profileId)}
                      >
                        {busyId === peer.profileId ? 'Sending…' : 'Send Connection Request'}
                      </button>
                    ) : null}
                    {ui === 'pending_sent' ? (
                      <span className="app-btn app-btn--ghost app-btn--small" aria-disabled>
                        Requested
                      </span>
                    ) : null}
                    {ui === 'pending_received' ? (
                      <button
                        type="button"
                        className="app-btn app-btn--primary app-btn--small"
                        disabled={busyId === peer.profileId}
                        onClick={() => void accept(peer.profileId)}
                      >
                        Accept
                      </button>
                    ) : null}
                    {ui === 'connected' ? (
                      <span className="app-btn app-btn--secondary app-btn--small" aria-disabled>
                        Connected
                      </span>
                    ) : null}
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
