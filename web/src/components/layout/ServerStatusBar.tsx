import { useServerStatus } from '@/hooks/use-server-status';
import { isApiUrlConfigured } from '@/lib/api-url';

export function ServerStatusBar() {
  const { status, apiUrl, latencyMs, message } = useServerStatus();

  if (!isApiUrlConfigured() || status === 'unknown') {
    return null;
  }

  const label =
    status === 'checking'
      ? 'Checking API…'
      : status === 'online'
        ? `API connected${latencyMs != null ? ` · ${latencyMs}ms` : ''}`
        : 'API unreachable';

  return (
    <div
      className={`server-status server-status--${status}`}
      role="status"
      title={message ?? apiUrl}
    >
      <span className="server-status__dot" aria-hidden="true" />
      <span className="server-status__text">{label}</span>
      {status === 'offline' && apiUrl ? (
        <span className="server-status__hint">
          Open the app at your PC&apos;s network IP (not localhost) on the same Wi‑Fi, e.g.{' '}
          <code>http://10.0.0.165:5173</code> — API: <code>{apiUrl}</code>
        </span>
      ) : null}
    </div>
  );
}
