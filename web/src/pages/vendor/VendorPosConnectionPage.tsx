import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorActionGrid,
  VendorFormPanel,
  VendorHero,
  VendorListPanel,
  VendorPrimaryButton,
  VendorScreen,
  VendorSecondaryButton,
  VendorSection,
  VendorStatusPill,
} from '@/components/vendor/vendor-ui';
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
    <VendorScreen>
      <Link to="/vendor/pos" className="app-back-link">← POS</Link>
      <VendorHero
        eyebrow={PROVIDER_LABEL[connection.provider] ?? connection.provider}
        title="Connection"
        pill={connection.status}
      />

      <VendorFormPanel className="mb-5">
        <p className="m-0 text-xs text-stone-500">
          Last synced: {connection.lastSyncedAt ? formatRelativeTime(connection.lastSyncedAt) : 'never'}
        </p>
        <p className="m-0 mt-1 text-xs text-stone-500">
          Auto-sync every {connection.syncFrequencyMinutes} min
        </p>
        {webhookEnabled ? (
          <p className="m-0 mt-2 text-xs font-semibold text-emerald-700">Real-time webhooks enabled</p>
        ) : null}
      </VendorFormPanel>

      <VendorActionGrid>
        <VendorPrimaryButton className="w-full" disabled={syncing} onClick={() => void syncNow()}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </VendorPrimaryButton>
        {!webhookEnabled ? (
          <VendorSecondaryButton
            className="w-full"
            disabled={enablingWebhook}
            onClick={() => void enableWebhook()}
          >
            {enablingWebhook ? 'Enabling…' : 'Enable real-time updates'}
          </VendorSecondaryButton>
        ) : null}
        <VendorSecondaryButton className="w-full" to="/vendor/pos/mappings">
          Item mappings
        </VendorSecondaryButton>
        <VendorSecondaryButton className="w-full" onClick={() => void disconnect()}>
          Disconnect
        </VendorSecondaryButton>
      </VendorActionGrid>

      {connection.errorMessage ? <p className="app-error">{connection.errorMessage}</p> : null}
      {error ? <p className="app-error">{error}</p> : null}

      {runs.length > 0 ? (
        <VendorSection title="Recent syncs">
          <VendorListPanel>
            {runs.slice(0, 8).map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-3 p-3.5">
                <span className="flex min-w-0 items-center gap-3">
                  <IconBadge name="credit-card" tone="amber" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-stone-800">{run.status}</span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                      {run.finishedAt ? formatDateTime(run.finishedAt) : 'In progress'} · imported{' '}
                      {run.transactionsImported}
                    </span>
                  </span>
                </span>
                <VendorStatusPill label={run.status} />
              </div>
            ))}
          </VendorListPanel>
        </VendorSection>
      ) : null}
    </VendorScreen>
  );
}
