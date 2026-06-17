import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { posApi } from '@/lib/pos-api';
import type { PosConnection, PosSyncRun } from '@/types/pos';
import '@/components/ui/ui.css';

const PROVIDER_LABEL: Record<string, string> = {
  SQUARE: 'Square',
  TOAST: 'Toast',
  CLOVER: 'Clover',
};

export function VendorPosConnectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<PosConnection | null>(null);
  const [runs, setRuns] = useState<PosSyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [enablingWebhook, setEnablingWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [conn, syncRuns] = await Promise.all([
        posApi.getConnection(id),
        posApi.listSyncRuns(id),
      ]);
      setConnection(conn);
      setRuns(syncRuns);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    if (!id) return;
    setSyncing(true);
    setError(null);
    try {
      await posApi.triggerSync(id);
      setTimeout(() => void load(), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function enableWebhook() {
    if (!id) return;
    setEnablingWebhook(true);
    setError(null);
    try {
      const updated = await posApi.registerWebhook(id);
      setConnection(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnablingWebhook(false);
    }
  }

  async function disconnect() {
    if (!id || !window.confirm('Disconnect POS and remove stored credentials?')) return;
    try {
      await posApi.disconnect(id);
      navigate('/vendor/pos');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading || !connection) {
    return <div className="app-loading"><div className="app-spinner" /></div>;
  }

  const webhookEnabled = Boolean(connection.metadata?.webhookSubscriptionId);

  return (
    <div className="app-screen">
      <Link to="/vendor/pos" className="app-back-link">← POS</Link>
      <p className="app-eyebrow">{PROVIDER_LABEL[connection.provider] ?? connection.provider}</p>
      <h1 className="app-title">Connection</h1>

      <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
        <p className="app-row-meta">Status</p>
        <p className="app-row-title">{connection.status}</p>
        <p className="app-row-meta">
          Last synced: {connection.lastSyncedAt ? formatRelativeTime(connection.lastSyncedAt) : 'never'}
        </p>
        <p className="app-row-meta">Auto-sync every {connection.syncFrequencyMinutes} min</p>
      </div>

      <div className="app-list" style={{ marginBottom: '1rem' }}>
        <button type="button" className="app-btn app-btn--primary" disabled={syncing} onClick={() => void syncNow()}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {!webhookEnabled ? (
          <button type="button" className="app-btn app-btn--secondary" disabled={enablingWebhook} onClick={() => void enableWebhook()}>
            {enablingWebhook ? 'Enabling…' : 'Enable real-time updates'}
          </button>
        ) : (
          <p className="app-row-meta" style={{ color: 'var(--color-forest)' }}>Real-time webhooks enabled</p>
        )}
        <Link to="/vendor/pos/mappings" className="app-card app-card--pressable" style={{ display: 'block' }}>
          Item mappings
        </Link>
        <button type="button" className="app-btn app-btn--secondary" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>

      {connection.errorMessage ? <p className="app-error">{connection.errorMessage}</p> : null}
      {error ? <p className="app-error">{error}</p> : null}

      {runs.length > 0 ? (
        <>
          <h2 style={{ fontSize: '1.125rem' }}>Recent syncs</h2>
          <div className="app-list">
            {runs.slice(0, 8).map((run) => (
              <div key={run.id} className="app-card">
                <p className="app-row-title">{run.status}</p>
                <p className="app-row-meta">
                  {run.finishedAt ? formatDateTime(run.finishedAt) : 'In progress'} · imported {run.transactionsImported}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
