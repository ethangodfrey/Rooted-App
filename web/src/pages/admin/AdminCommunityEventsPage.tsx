import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  approveCommunityEvent,
  fetchCommunityEventsForAdmin,
  rejectCommunityEvent,
  runCommunityEventAiVerify,
  runLiveEventIngestSearch,
  type AdminCommunitySourceFilter,
  type CommunityEvent,
} from '@/lib/community-events';
import '@/components/ui/ui.css';
import './admin-community-events.css';

type StatusFilter = 'pending' | 'all';

const STATUS_LABEL: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

export function AdminCommunityEventsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [sourceFilter, setSourceFilter] =
    useState<AdminCommunitySourceFilter>('vendor');
  const [rows, setRows] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCommunityEventsForAdmin(statusFilter, sourceFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load community events.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

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

  async function handleRunLiveSearch() {
    setIngesting(true);
    setError(null);
    setNotice(null);
    try {
      if (!isApiConfigured) {
        throw new Error(
          'Backend API is not configured. Set VITE_API_URL to run the search worker.',
        );
      }
      const result = await runLiveEventIngestSearch({
        query: 'community festivals holiday markets pop-up events',
        region: 'Denver, CO',
        limit: 5,
      });
      setSourceFilter('ai');
      setStatusFilter('pending');
      setNotice(
        `INGESTED ${result.ingested} EVENTS · SOURCE ${result.source.toUpperCase()}`,
      );
      setRows(await fetchCommunityEventsForAdmin('pending', 'ai'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live search worker failed.');
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="app-screen ace-admin">
      <p className="app-eyebrow">REVIEW</p>
      <h1 className="app-title">Community event review</h1>
      <p className="app-subtitle">
        Toggle vendor submissions against AI-discovered festivals and markets. Approve to
        publish onto the shopper map.
      </p>

      <div className="ace-admin__toolbar">
        <button
          type="button"
          className="app-btn app-btn--primary"
          disabled={ingesting}
          onClick={() => void handleRunLiveSearch()}
        >
          {ingesting ? 'RUNNING…' : '[ RUN LIVE SEARCH WORKER ]'}
        </button>
      </div>

      <div className="app-scope-toggle ace-admin__toggle" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={sourceFilter === 'vendor' ? 'active' : ''}
          onClick={() => setSourceFilter('vendor')}
        >
          VENDOR SUBMISSIONS
        </button>
        <button
          type="button"
          className={sourceFilter === 'ai' ? 'active' : ''}
          onClick={() => setSourceFilter('ai')}
        >
          AI INGESTED EVENTS
        </button>
      </div>

      <div className="app-scope-toggle" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={statusFilter === 'pending' ? 'active' : ''}
          onClick={() => setStatusFilter('pending')}
        >
          PENDING
        </button>
        <button
          type="button"
          className={statusFilter === 'all' ? 'active' : ''}
          onClick={() => setStatusFilter('all')}
        >
          ALL
        </button>
      </div>

      {notice ? <p className="ace-admin__notice">{notice}</p> : null}
      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="app-empty">
          {sourceFilter === 'ai'
            ? 'No AI ingested events in this queue. Run the live search worker.'
            : 'No vendor community events in this queue.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((row) => {
            const meta = row.ai_source_metadata ?? {};
            const confidence =
              typeof meta.scraping_confidence === 'number'
                ? Math.round(meta.scraping_confidence * 100)
                : null;
            const urls = Array.isArray(meta.tracking_urls) ? meta.tracking_urls : [];
            const snippets = Array.isArray(meta.source_snippets)
              ? meta.source_snippets
              : [];

            return (
              <li key={row.id} className="app-card ace-admin__card" style={{ marginBottom: '0.75rem' }}>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="ace-admin__meta-row">
                      <p className="app-row-meta" style={{ margin: 0 }}>
                        {STATUS_LABEL[row.verification_status] ?? row.verification_status} ·{' '}
                        {row.event_type.replace(/_/g, ' ')}
                      </p>
                      {row.is_ai_ingested ? (
                        <span className="ace-admin__ai-sticker">[ AI INGESTED ]</span>
                      ) : (
                        <span className="ace-admin__ai-sticker ace-admin__ai-sticker--vendor">
                          [ VENDOR ]
                        </span>
                      )}
                    </div>
                    <p className="app-row-title" style={{ margin: '0.25rem 0 0' }}>
                      {row.title}
                    </p>
                    <p className="app-row-meta">
                      {new Date(row.start_time).toLocaleString()} —{' '}
                      {new Date(row.end_time).toLocaleString()}
                    </p>
                    <p className="app-row-meta">
                      LAT {row.latitude.toFixed(4)} · LNG {row.longitude.toFixed(4)}
                    </p>
                    {row.description ? (
                      <p className="app-row-meta" style={{ marginTop: '0.35rem' }}>
                        {row.description}
                      </p>
                    ) : null}
                    {row.is_ai_ingested ? (
                      <div className="ace-admin__source">
                        {confidence != null ? (
                          <p className="app-row-meta" style={{ margin: 0 }}>
                            SCRAPE CONFIDENCE {confidence}%
                          </p>
                        ) : null}
                        {urls[0] ? (
                          <p className="app-row-meta" style={{ margin: '0.25rem 0 0' }}>
                            SOURCE {urls[0]}
                          </p>
                        ) : null}
                        {snippets[0] ? (
                          <p className="app-row-meta" style={{ margin: '0.25rem 0 0' }}>
                            SNIPPET {snippets[0]}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {row.ai_recommendation ? (
                    <div className="ace-admin__assist">
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
                      {actingId === row.id ? 'RUNNING…' : '[ RUN SEARCH ]'}
                    </button>
                    {row.verification_status !== 'approved' ? (
                      <button
                        type="button"
                        className="app-btn app-btn--primary app-btn--small"
                        disabled={actingId === row.id}
                        onClick={() => void handleApprove(row)}
                      >
                        [ APPROVE & PUBLISH ]
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
                        [ REJECT ]
                      </button>
                    ) : null}
                  </div>

                  {rejectingId === row.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="app-input w-full min-h-[72px]"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Optional reject reason"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="app-btn app-btn--primary app-btn--small"
                          disabled={actingId === row.id}
                          onClick={() => void handleReject(row)}
                        >
                          [ CONFIRM REJECT ]
                        </button>
                        <button
                          type="button"
                          className="app-btn app-btn--secondary app-btn--small"
                          onClick={() => setRejectingId(null)}
                        >
                          [ CANCEL ]
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
