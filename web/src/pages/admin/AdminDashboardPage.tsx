import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ActiveFleet } from '@/components/admin/ActiveFleet';
import { DisputeQueue } from '@/components/admin/DisputeQueue';
import { GlobalLedger } from '@/components/admin/GlobalLedger';
import { PlatformMetricsBanner } from '@/components/admin/PlatformMetricsBanner';
import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  fetchAdminLedger,
  fetchAdminLogistics,
  fetchAdminTelemetry,
  formatAdminDashboardActiveLog,
  formatSystemTelemetryInitializedLog,
  type AdminFleetRoute,
  type AdminLedgerResponse,
  type AdminTelemetry,
} from '@/lib/admin-dashboard';
import {
  approveDisputeRefund,
  dismissDispute,
  fetchAdminDisputeQueue,
  formatDisputeEngineInitializedLog,
  type DisputeItem,
} from '@/lib/disputes';
import '@/components/ui/ui.css';

type DashboardTab = 'overview' | 'disputes' | 'fleet';

/**
 * Phase 7–8 Platform Admin Dashboard + Dispute Queue.
 * Route: /admin/dashboard — AdminLayout enforces role === admin.
 */
export function AdminDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [telemetry, setTelemetry] = useState<AdminTelemetry | null>(null);
  const [ledger, setLedger] = useState<AdminLedgerResponse | null>(null);
  const [routes, setRoutes] = useState<AdminFleetRoute[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [actingDisputeId, setActingDisputeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    console.log(formatSystemTelemetryInitializedLog());
    console.log(formatAdminDashboardActiveLog());
    console.log(formatDisputeEngineInitializedLog());
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      setLoadingMetrics(false);
      return;
    }
    setLoadingMetrics(true);
    try {
      const data = await fetchAdminTelemetry();
      setTelemetry(data);
      console.log(
        formatAdminDashboardActiveLog({
          gmvCents: data.TOTAL_GMV_CENTS,
          escrowCents: data.ACTIVE_ESCROW_CENTS,
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load platform telemetry',
      );
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const loadFleet = useCallback(async () => {
    if (!isApiConfigured) {
      setLoadingFleet(false);
      return;
    }
    setLoadingFleet(true);
    try {
      const data = await fetchAdminLogistics(50);
      setRoutes(data.ITEMS ?? []);
      console.log(
        `ADMIN_DASHBOARD_ACTIVE FLEET_IN_TRANSIT=${data.COUNT ?? 0}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load active fleet',
      );
    } finally {
      setLoadingFleet(false);
    }
  }, []);

  const loadDisputes = useCallback(async () => {
    if (!isApiConfigured) {
      setLoadingDisputes(false);
      return;
    }
    setLoadingDisputes(true);
    try {
      const data = await fetchAdminDisputeQueue(50);
      setDisputes(data.ITEMS ?? []);
      console.log(`DISPUTE_ENGINE_INITIALIZED QUEUE=${data.COUNT ?? 0}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load dispute queue',
      );
    } finally {
      setLoadingDisputes(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    if (!isApiConfigured) {
      setLoadingLedger(false);
      return;
    }
    setLoadingLedger(true);
    try {
      const data = await fetchAdminLedger({
        page,
        pageSize: 20,
        status: statusFilter || undefined,
        transactionType: typeFilter || undefined,
        sortBy,
        sortDir,
      });
      setLedger(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load global ledger',
      );
    } finally {
      setLoadingLedger(false);
    }
  }, [page, statusFilter, typeFilter, sortBy, sortDir]);

  useEffect(() => {
    void loadMetrics();
    void loadFleet();
    void loadDisputes();
  }, [loadMetrics, loadFleet, loadDisputes]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  function onSort(column: string) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'created_at' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  async function onApproveRefund(disputeId: string) {
    setActingDisputeId(disputeId);
    setError(null);
    try {
      await approveDisputeRefund(disputeId, 'APPROVE_REFUND');
      console.log(`DISPUTE_ENGINE_INITIALIZED ACTION=RESOLVED_REFUNDED ID=${disputeId}`);
      await Promise.all([loadDisputes(), loadLedger(), loadMetrics()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setActingDisputeId(null);
    }
  }

  async function onDismiss(disputeId: string) {
    setActingDisputeId(disputeId);
    setError(null);
    try {
      await dismissDispute(disputeId, { notes: 'DISMISS_DISPUTE', settle: false });
      console.log(`DISPUTE_ENGINE_INITIALIZED ACTION=RESOLVED_RELEASED ID=${disputeId}`);
      await Promise.all([loadDisputes(), loadLedger(), loadMetrics()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setActingDisputeId(null);
    }
  }

  if (user?.role && user.role !== 'admin') {
    return (
      <div className="app-screen">
        <FieldError message="ADMIN_ROLE_REQUIRED — platform dashboard is admin-only." />
        <Link to="/app" className="app-btn app-btn--secondary mt-4">
          Leave admin
        </Link>
      </div>
    );
  }

  const tabs: Array<{ id: DashboardTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'disputes', label: `Dispute Queue (${disputes.length})` },
    { id: 'fleet', label: 'Active Fleet' },
  ];

  return (
    <div className="app-screen" style={{ maxWidth: 1100 }}>
      <p className="app-eyebrow">Phase 7–8 admin</p>
      <h1 className="app-title">Platform Dashboard</h1>
      <p className="ft-subhead" style={{ marginBottom: '1.25rem' }}>
        Cross-tenant GMV, escrow, disputes, and in-transit fleet for marketplace
        operators.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              tab === item.id
                ? 'app-btn app-btn--primary app-btn--small'
                : 'app-btn app-btn--secondary app-btn--small'
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
        <Link to="/admin/vendors" className="app-btn app-btn--secondary app-btn--small">
          Vendors
        </Link>
      </div>

      {error ? <FieldError message={error} /> : null}

      {tab === 'overview' ? (
        <>
          <PlatformMetricsBanner telemetry={telemetry} loading={loadingMetrics} />
          <section className="mb-8">
            <h2 className="app-section-title">Global Ledger</h2>
            <GlobalLedger
              ledger={ledger}
              loading={loadingLedger}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              sortBy={sortBy}
              sortDir={sortDir}
              onStatusFilter={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              onTypeFilter={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
              onSort={onSort}
              onPage={setPage}
            />
          </section>
        </>
      ) : null}

      {tab === 'disputes' ? (
        <section className="mb-8">
          <h2 className="app-section-title">Dispute Queue</h2>
          <DisputeQueue
            items={disputes}
            loading={loadingDisputes}
            actingId={actingDisputeId}
            onApproveRefund={(id) => void onApproveRefund(id)}
            onDismiss={(id) => void onDismiss(id)}
          />
        </section>
      ) : null}

      {tab === 'fleet' ? (
        <section>
          <h2 className="app-section-title">Active Fleet</h2>
          <ActiveFleet routes={routes} loading={loadingFleet} />
        </section>
      ) : null}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-wide text-white/40">
        ADMIN_DASHBOARD_ACTIVE · DISPUTE_ENGINE_INITIALIZED
      </p>
    </div>
  );
}
