import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { useServerStatus } from '@/hooks/use-server-status';
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton';
import { isApiConfigured } from '@/lib/api';
import { BACKEND_UNAVAILABLE_COPY } from '@/lib/api-url';
import '@/components/ui/ui.css';

export function AdminMorePage() {
  const { user, signOut } = useAuth();
  const server = useServerStatus(15_000, isApiConfigured);
  const ingestionLive = !isApiConfigured || server.status === 'online' || server.status === 'checking';

  const logRows = [
    {
      label: 'Ingestion pipeline',
      value: ingestionLive ? 'Active' : 'Unreachable',
      meta: !isApiConfigured
        ? 'Local cron / markets pipelines available'
        : server.status === 'online'
          ? `${server.apiUrl}${server.latencyMs != null ? ` · ${server.latencyMs}ms` : ''}`
          : server.status === 'checking'
            ? `Checking ${server.apiUrl}…`
            : server.message ?? server.apiUrl,
    },
    {
      label: 'Session',
      value: user?.email ?? '—',
      meta: 'Signed-in admin principal',
    },
    {
      label: 'Automation',
      value: 'Cron ready',
      meta: 'npm run admin:agent · admin:posts · markets pipelines',
    },
    {
      label: 'Backend API',
      value: !isApiConfigured
        ? 'Not deployed'
        : server.status === 'online'
          ? 'Connected'
          : server.status === 'checking'
            ? 'Checking…'
            : 'Unreachable',
      meta: !isApiConfigured ? BACKEND_UNAVAILABLE_COPY : server.apiUrl,
    },
  ];

  return (
    <div className="app-screen" style={{ maxWidth: 1100 }}>
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Systems</h1>
      <p className="ft-subhead" style={{ marginBottom: '1.5rem' }}>
        Command center — live log on the left, oversized actions on the right.
      </p>

      <div className="admin-status-banner" role="status" style={{ marginBottom: '1.25rem' }}>
        <span className="admin-status-banner__pulse" aria-hidden="true" />
        <div>
          <p className="ft-label" style={{ marginBottom: 0 }}>
            System ingestion status
          </p>
          <p className="admin-status-banner__title">
            {ingestionLive ? 'Pipelines active' : 'Pipelines unreachable'}
          </p>
          <p className="admin-status-banner__meta">
            Real-time health for marketplace ingest and admin automation.
          </p>
        </div>
      </div>

      <div className="admin-console">
        <section className="admin-console__log" aria-label="Realtime system log">
          <p className="ft-label">Realtime monitor</p>
          {logRows.map((row) => (
            <div key={row.label} className="admin-console__log-row">
              <div>
                <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
                  {row.label}
                </p>
                <p className="app-row-title">{row.value}</p>
                <p className="ft-subhead" style={{ marginTop: '0.35rem' }}>
                  {row.meta}
                </p>
              </div>
            </div>
          ))}
        </section>

        <aside className="admin-console__actions" aria-label="System actions">
          <p className="ft-label">System actions</p>
          <Link to="/admin/credentials" className="app-btn app-btn--primary">
            Credential review
          </Link>
          <Link to="/admin/community-events" className="app-btn app-btn--secondary">
            Community event review
          </Link>
          <Link to="/admin/vendors" className="app-btn app-btn--secondary">
            Vendor queue
          </Link>
          <Link to="/admin/orders" className="app-btn app-btn--secondary">
            Orders log
          </Link>
          <Link to="/admin/events" className="app-btn app-btn--secondary">
            Markets & events
          </Link>
          <button type="button" className="app-btn app-btn--secondary" onClick={signOut}>
            Sign out
          </button>
          <DeleteAccountButton />
        </aside>
      </div>
    </div>
  );
}
