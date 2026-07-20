import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ActiveFleet } from '@/components/admin/ActiveFleet';
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
import '@/components/ui/ui.css';

/**
 * Phase 7 Platform Admin Dashboard.
 * Route: /admin/dashboard — AdminLayout enforces role === admin.
 */
export function AdminDashboardPage() {
  const { user } = useAuth();
  const [telemetry, setTelemetry] = useState<AdminTelemetry | null>(null);
  const [ledger, setLedger] = useState<AdminLedgerResponse | null>(null);
  const [routes, setRoutes] = useState<AdminFleetRoute[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    console.log(formatSystemTelemetryInitializedLog());
    console.log(formatAdminDashboardActiveLog());
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
  }, [loadMetrics, loadFleet]);

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

  return (
    <div className="app-screen" style={{ maxWidth: 1100 }}>
      <p className="app-eyebrow">Phase 7 admin</p>
      <h1 className="app-title">Platform Dashboard</h1>
      <p className="ft-subhead" style={{ marginBottom: '1.25rem' }}>
        Cross-tenant GMV, escrow, ledger, and in-transit fleet for marketplace
        operators.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/admin/vendors" className="app-btn app-btn--secondary app-btn--small">
          Vendors
        </Link>
        <Link to="/admin/orders" className="app-btn app-btn--secondary app-btn--small">
          Orders
        </Link>
        <Link to="/admin/more" className="app-btn app-btn--secondary app-btn--small">
          Systems
        </Link>
      </div>

      {error ? <FieldError message={error} /> : null}

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

      <section>
        <h2 className="app-section-title">Active Fleet</h2>
        <ActiveFleet routes={routes} loading={loadingFleet} />
      </section>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-wide text-white/40">
        ADMIN_DASHBOARD_ACTIVE · SYSTEM_TELEMETRY_INITIALIZED
      </p>
    </div>
  );
}
