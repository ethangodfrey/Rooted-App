import { useAuth } from '@/hooks/use-auth';
import { useServerStatus } from '@/hooks/use-server-status';
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton';
import { isApiConfigured } from '@/lib/api';
import '@/components/ui/ui.css';

export function AdminMorePage() {
  const { user, signOut } = useAuth();
  const server = useServerStatus(15_000);

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">More</h1>

      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        <p className="app-row-meta">Signed in as</p>
        <p className="app-row-title">{user?.email}</p>
      </div>

      <div className="app-list">
        <div className="app-card">
          <p className="app-row-title">Backend API</p>
          <p className="app-row-meta">
            {!isApiConfigured
              ? 'Not configured — set VITE_API_URL'
              : server.status === 'online'
                ? `Connected · ${server.apiUrl}${server.latencyMs != null ? ` · ${server.latencyMs}ms` : ''}`
                : server.status === 'checking'
                  ? `Checking ${server.apiUrl}…`
                  : server.message ?? `Unreachable at ${server.apiUrl}`}
          </p>
        </div>
        <div className="app-card app-card--honeydew">
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
