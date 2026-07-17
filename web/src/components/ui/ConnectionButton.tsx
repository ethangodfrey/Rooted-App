import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  acceptNetworkConnection,
  fetchNetworkConnection,
  ignoreNetworkConnection,
  resolveMessageThreadForPeer,
  sendNetworkConnectionRequest,
  type NetworkConnectionUi,
} from '@/lib/network-connections';

export type ConnectionButtonStatus = 'PENDING' | 'CONNECTED' | 'IGNORED' | null;

type ConnectionButtonProps = {
  targetProfileId: string;
  /** Optional preloaded status from directory query. */
  initialStatus?: ConnectionButtonStatus;
  /** When initialStatus is PENDING, whether the current user is the sender. */
  initialIsSender?: boolean | null;
  className?: string;
  onStatusChange?: (ui: NetworkConnectionUi) => void;
};

const BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: 'solid',
  padding: '0.4rem 0.75rem',
  fontSize: '0.625rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  background: 'transparent',
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

/** Map directory uiState → ConnectionButton props. */
export function connectionUiToButtonProps(ui: NetworkConnectionUi | undefined): {
  initialStatus: ConnectionButtonStatus;
  initialIsSender: boolean | null;
} {
  if (ui === 'connected') return { initialStatus: 'CONNECTED', initialIsSender: null };
  if (ui === 'pending_sent') return { initialStatus: 'PENDING', initialIsSender: true };
  if (ui === 'pending_received') return { initialStatus: 'PENDING', initialIsSender: false };
  return { initialStatus: null, initialIsSender: null };
}

function uiFromInitial(
  status: ConnectionButtonStatus | undefined,
  isSender: boolean | null | undefined,
): NetworkConnectionUi {
  if (status === 'CONNECTED') return 'connected';
  if (status === 'IGNORED') return 'none';
  if (status === 'PENDING') {
    if (isSender === false) return 'pending_received';
    return 'pending_sent';
  }
  return 'none';
}

/**
 * Unified B2B connection action — uppercase text only, no emojis.
 * CONNECT · REQUEST SENT · ACCEPT / IGNORE · MESSAGE
 */
export function ConnectionButton({
  targetProfileId,
  initialStatus = null,
  initialIsSender = null,
  className,
  onStatusChange,
}: ConnectionButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profileId = user?.id ?? null;

  const [ui, setUi] = useState<NetworkConnectionUi>(() =>
    uiFromInitial(initialStatus, initialIsSender),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUi(uiFromInitial(initialStatus, initialIsSender));
  }, [initialStatus, initialIsSender, targetProfileId]);

  useEffect(() => {
    let active = true;
    if (!profileId || !targetProfileId || profileId === targetProfileId) return;

    void fetchNetworkConnection(profileId, targetProfileId)
      .then((view) => {
        if (!active) return;
        setUi(view.uiState);
        onStatusChange?.(view.uiState);
      })
      .catch(() => {
        /* keep initial */
      });

    return () => {
      active = false;
    };
    // Intentionally omit onStatusChange — parents often pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, targetProfileId]);

  if (!profileId || profileId === targetProfileId) return null;

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const view = await sendNetworkConnectionRequest(profileId!, targetProfileId);
      setUi(view.uiState);
      onStatusChange?.(view.uiState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect');
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const view = await acceptNetworkConnection(profileId!, targetProfileId);
      setUi(view.uiState);
      onStatusChange?.(view.uiState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept');
    } finally {
      setBusy(false);
    }
  }

  async function ignore() {
    setBusy(true);
    setError(null);
    try {
      const view = await ignoreNetworkConnection(profileId!, targetProfileId);
      setUi(view.uiState);
      onStatusChange?.(view.uiState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to ignore');
    } finally {
      setBusy(false);
    }
  }

  async function openMessage() {
    setBusy(true);
    setError(null);
    try {
      const threadId = await resolveMessageThreadForPeer(profileId!, targetProfileId);
      if (!threadId) {
        setError('Connect before messaging.');
        return;
      }
      navigate(`/vendor/inbox/chat/${targetProfileId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open chat');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      {ui === 'none' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void connect()}
          style={{
            ...BTN,
            borderColor: 'rgba(161, 161, 170, 0.55)',
            color: '#e4e4e7',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '…' : '[ CONNECT ]'}
        </button>
      ) : null}

      {ui === 'pending_sent' ? (
        <button
          type="button"
          disabled
          style={{
            ...BTN,
            borderColor: '#27272a',
            color: '#71717a',
            background: 'rgba(9, 9, 11, 0.55)',
            cursor: 'default',
          }}
        >
          [ REQUEST SENT ]
        </button>
      ) : null}

      {ui === 'pending_received' ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void accept()}
            style={{
              ...BTN,
              borderColor: 'rgba(52, 211, 153, 0.45)',
              color: '#a7f3d0',
              background: 'rgba(16, 185, 129, 0.1)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            [ ACCEPT ]
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void ignore()}
            style={{
              ...BTN,
              borderColor: '#3f3f46',
              color: '#a1a1aa',
              opacity: busy ? 0.6 : 1,
            }}
          >
            [ IGNORE ]
          </button>
        </div>
      ) : null}

      {ui === 'connected' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void openMessage()}
          style={{
            ...BTN,
            borderColor: 'rgba(52, 211, 153, 0.4)',
            color: '#a7f3d0',
            background: 'rgba(16, 185, 129, 0.1)',
            opacity: busy ? 0.6 : 1,
          }}
        >
          [ MESSAGE ]
        </button>
      ) : null}

      {error ? (
        <span style={{ fontSize: 10, color: '#fca5a5', maxWidth: 180 }}>{error}</span>
      ) : null}
    </div>
  );
}
