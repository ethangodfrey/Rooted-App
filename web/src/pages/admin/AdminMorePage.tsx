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

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Systems</h1>
      <p className="ft-subhead" style={{ marginBottom: '1.25rem' }}>
        Command center for ingestion, credentials, and ops scripts.
      </p>

      <div className="admin-status-banner" role="status">
        <span className="admin-status-banner__pulse" aria-hidden="true" />
        <div>
          <p className="ft-label" style={{ marginBottom: 0 }}>
            System ingestion status
          </p>
          <p className="admin-status-banner__title">
            {ingestionLive ? 'Pipelines active' : 'Pipelines unreachable'}
          </p>
          <p className="admin-status-banner__meta">
            {!isApiConfigured
              ? `API optional — local cron / markets pipelines remain available. ${BACKEND_UNAVAILABLE_COPY}`
              : server.status === 'online'
                ? `Live · ${server.apiUrl}${server.latencyMs != null ? ` · ${server.latencyMs}ms` : ''}`
                : server.status === 'checking'
                  ? `Checking ${server.apiUrl}…`
                  : server.message ?? `Unreachable at ${server.apiUrl}`}
          </p>
        </div>
      </div>

      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
          Signed in as
        </p>
        <p className="app-row-title">{user?.email}</p>
      </div>

      <div className="app-list">
        <Link to="/admin/credentials" className="app-card app-card--pressable">
          <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
            Trust
          </p>
          <p className="app-row-title">Credential review</p>
          <p className="app-row-meta">Verify vendor & chef documents and award trust badges</p>
        </Link>
        <div className="app-card">
          <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
            Backend API
          </p>
          <p className="app-row-title">
            {!isApiConfigured
              ? 'Not deployed'
              : server.status === 'online'
                ? 'Connected'
                : server.status === 'checking'
                  ? 'Checking…'
                  : 'Unreachable'}
          </p>
          <p className="app-row-meta">
            {!isApiConfigured
              ? BACKEND_UNAVAILABLE_COPY
              : `${server.apiUrl}${server.latencyMs != null ? ` · ${server.latencyMs}ms` : ''}`}
          </p>
        </div>
        <div className="app-card app-card--honeydew">
          <p className="ft-label" style={{ marginBottom: '0.35rem' }}>
            Automation
          </p>
          <p className="app-row-title">Cron scripts</p>
          <p className="app-row-meta">npm run admin:agent · npm run admin:posts · markets pipelines</p>
        </div>
      </div>

      <button type="button" className="app-btn app-btn--secondary" style={{ marginTop: '2rem' }} onClick={signOut}>
        Sign out
      </button>
      <DeleteAccountButton />
    </div>
  );
}
