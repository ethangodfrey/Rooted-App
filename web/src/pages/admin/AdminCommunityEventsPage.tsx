import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  approveCommunityEvent,
  fetchCommunityEventsForAdmin,
  rejectCommunityEvent,
  runCommunityEventAiVerify,
  type CommunityEvent,
} from '@/lib/community-events';
import '@/components/ui/ui.css';

type Filter = 'pending' | 'all';

const STATUS_LABEL: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

export function AdminCommunityEventsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCommunityEventsForAdmin(filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load community events.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(row: CommunityEvent) {
    if (!user) return;
    setActingId(row.id);
    setError(null);
    try {
      await approveCommunityEvent(row.id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve event.');
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(row: CommunityEvent) {
    if (!user) return;
    setActingId(row.id);
    setError(null);
    try {
      await rejectCommunityEvent(row.id, user.id, rejectReason);
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject event.');
    } finally {
      setActingId(null);
    }
  }

  async function handleAiVerify(row: CommunityEvent) {
    setActingId(row.id);
    setError(null);
    try {
      if (!isApiConfigured) {
        throw new Error(
          'Backend API is not configured. Set VITE_API_URL to run AI verification.',
        );
      }
      await runCommunityEventAiVerify(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI verification failed.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Community event review</h1>
      <p className="app-subtitle">
        Host-submitted festivals and pop-ups stay PENDING until approved. Optional AI assist
        suggests approve / reject / needs review — it never publishes on its own.
      </p>

      <div className="app-scope-toggle" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          PENDING
        </button>
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          ALL
        </button>
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="app-empty">No community events in this queue.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((row) => (
            <li key={row.id} className="app-card" style={{ marginBottom: '0.75rem' }}>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="app-row-meta" style={{ margin: 0 }}>
                    {STATUS_LABEL[row.verification_status] ?? row.verification_status} ·{' '}
                    {row.event_type.replace(/_/g, ' ')}
                  </p>
                  <p className="app-row-title" style={{ margin: '0.25rem 0 0' }}>
                    {row.title}
                  </p>
                  <p className="app-row-meta">
                    {new Date(row.start_time).toLocaleString()} —{' '}
                    {new Date(row.end_time).toLocaleString()}
                  </p>
                  <p className="app-row-meta">
                    {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
                  </p>
                  {row.description ? (
                    <p className="app-row-meta" style={{ marginTop: '0.35rem' }}>
                      {row.description}
                    </p>
                  ) : null}
                </div>

                {row.ai_recommendation ? (
                  <div
                    style={{
                      border: '1px solid rgba(24,24,27,0.08)',
                      borderRadius: 8,
                      padding: '0.75rem',
                      background: 'rgba(255,247,237,0.7)',
                    }}
                  >
                    <p className="app-row-meta" style={{ margin: 0 }}>
                      AI ASSIST · {row.ai_recommendation.toUpperCase()}
                      {row.ai_confidence != null
                        ? ` · ${Math.round(row.ai_confidence * 100)}%`
                        : ''}
                    </p>
                    {row.ai_summary ? (
                      <p className="app-row-meta" style={{ margin: '0.35rem 0 0' }}>
                        {row.ai_summary}
                      </p>
                    ) : null}
                    {row.ai_flags?.length ? (
                      <p className="app-row-meta" style={{ margin: '0.35rem 0 0' }}>
                        FLAGS: {row.ai_flags.join(', ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="app-btn app-btn--secondary app-btn--small"
                    disabled={actingId === row.id}
                    onClick={() => void handleAiVerify(row)}
                  >
                    {actingId === row.id ? 'RUNNING…' : 'RUN AI VERIFY'}
                  </button>
                  {row.verification_status !== 'approved' ? (
                    <button
                      type="button"
                      className="app-btn app-btn--primary app-btn--small"
                      disabled={actingId === row.id}
                      onClick={() => void handleApprove(row)}
                    >
                      APPROVE
                    </button>
                  ) : null}
                  {row.verification_status !== 'rejected' ? (
                    <button
                      type="button"
                      className="app-btn app-btn--secondary app-btn--small"
                      disabled={actingId === row.id}
                      onClick={() => {
                        setRejectingId(row.id);
                        setRejectReason('');
                      }}
                    >
                      REJECT
                    </button>
                  ) : null}
                </div>

                {rejectingId === row.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="app-input w-full min-h-[72px]"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Optional reject reason for the host"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="app-btn app-btn--primary app-btn--small"
                        disabled={actingId === row.id}
                        onClick={() => void handleReject(row)}
                      >
                        CONFIRM REJECT
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn--secondary app-btn--small"
                        onClick={() => setRejectingId(null)}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
