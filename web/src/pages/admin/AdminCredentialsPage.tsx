import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import {
  CREDENTIAL_LABELS,
  approveCredential,
  fetchCredentialsForReview,
  rejectCredential,
  resolveCredentialDocumentUrl,
  type AdminCredentialRow,
} from '@/lib/verification';
import '@/components/ui/ui.css';

type Filter = 'pending' | 'all';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminCredentialsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<AdminCredentialRow[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCredentialsForReview(filter);
      setRows(data);
      const entries = await Promise.all(
        data.map(async (row) => {
          const url = await resolveCredentialDocumentUrl(row.document_url);
          return [row.id, url] as const;
        }),
      );
      const map: Record<string, string> = {};
      for (const [id, url] of entries) {
        if (url) map[id] = url;
      }
      setDocUrls(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load credentials.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(row: AdminCredentialRow) {
    if (!user) return;
    setActingId(row.id);
    setError(null);
    try {
      await approveCredential(row, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve credential.');
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(row: AdminCredentialRow) {
    if (!user) return;
    setActingId(row.id);
    setError(null);
    try {
      await rejectCredential(row.id, user.id, rejectReason);
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject credential.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Credential review</h1>
      <p className="app-subtitle">
        Verify vendor and chef documents. Approving awards the matching trust badge.
      </p>

      <div className="app-scope-toggle" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : rows.length === 0 ? (
        <p className="app-empty">
          {filter === 'pending' ? 'No pending credentials.' : 'No credentials found.'}
        </p>
      ) : (
        <div className="app-list">
          {rows.map((row) => {
            const isActing = actingId === row.id;
            const isRejecting = rejectingId === row.id;
            const isPending = row.verification_status === 'pending';

            return (
              <div key={row.id} className="app-card">
                <div className="app-page-header" style={{ marginBottom: '0.5rem' }}>
                  <div>
                    <p className="app-row-title">
                      {CREDENTIAL_LABELS[row.credential_type] ?? row.credential_type}
                    </p>
                    <p className="app-row-meta">
                      {row.users?.name ?? 'Unknown'} · {row.users?.role ?? '—'}
                    </p>
                    <p className="app-row-meta">{row.users?.email ?? 'No email'}</p>
                  </div>
                  <span className="app-status">
                    {STATUS_LABEL[row.verification_status] ?? row.verification_status}
                  </span>
                </div>

                {docUrls[row.id] ? (
                  <a href={docUrls[row.id]} target="_blank" rel="noreferrer">
                    <img
                      src={docUrls[row.id]}
                      alt="Credential document"
                      style={{
                        width: '100%',
                        maxHeight: '240px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        marginBottom: '0.75rem',
                      }}
                    />
                  </a>
                ) : (
                  <p className="app-row-meta">No document attached.</p>
                )}

                {row.issuing_authority ? (
                  <p className="app-row-meta">Issued by: {row.issuing_authority}</p>
                ) : null}
                {row.credential_number ? (
                  <p className="app-row-meta">Number: {row.credential_number}</p>
                ) : null}
                {row.expiry_date ? (
                  <p className="app-row-meta">Expires: {row.expiry_date}</p>
                ) : null}
                {row.verification_status === 'rejected' && row.rejection_reason ? (
                  <p className="app-error" style={{ marginTop: '0.375rem' }}>
                    Reason: {row.rejection_reason}
                  </p>
                ) : null}
                <p className="app-row-meta">Submitted {formatDate(row.created_at)}</p>

                {isPending ? (
                  isRejecting ? (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div className="app-input-group">
                        <label htmlFor={`reject-${row.id}`}>Rejection reason (optional)</label>
                        <textarea
                          id={`reject-${row.id}`}
                          className="app-textarea"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Let the submitter know what to fix…"
                        />
                      </div>
                      <button
                        type="button"
                        className="app-btn app-btn--primary"
                        disabled={isActing}
                        onClick={() => handleReject(row)}
                      >
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn--secondary"
                        style={{ marginTop: '0.5rem', width: '100%' }}
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}
                    >
                      <button
                        type="button"
                        className="app-btn app-btn--primary"
                        disabled={isActing}
                        onClick={() => handleApprove(row)}
                      >
                        {isActing ? 'Working…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="app-btn app-btn--secondary"
                        disabled={isActing}
                        onClick={() => {
                          setRejectingId(row.id);
                          setRejectReason('');
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
