import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  isAdminAgentConfigured,
  RECOMMENDATION_LABEL,
  recordVendorReviewFeedback,
  runVendorReviewQueue,
  type VendorReviewSuggestion,
} from '@/lib/admin-agent';
import { supabase } from '@/lib/supabase';
import type { ApprovalStatus, Vendor } from '@/types/database';
import '@/components/ui/ui.css';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

type AdminVendorRow = Vendor & {
  users: { email: string | null; name: string | null } | null;
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export function AdminVendorsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending');
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewingQueue, setReviewingQueue] = useState(false);
  const [suggestionsByVendor, setSuggestionsByVendor] = useState<Record<string, VendorReviewSuggestion>>({});

  const loadSuggestions = useCallback(async (vendorIds: string[]) => {
    if (vendorIds.length === 0) {
      setSuggestionsByVendor({});
      return;
    }
    const { data } = await supabase
      .from('vendor_review_suggestions')
      .select('id, vendor_id, recommendation, confidence, summary, flags, reasons, agent_version, created_at')
      .in('vendor_id', vendorIds)
      .order('created_at', { ascending: false });

    const map: Record<string, VendorReviewSuggestion> = {};
    for (const row of data ?? []) {
      if (map[row.vendor_id]) continue;
      map[row.vendor_id] = {
        ...row,
        confidence: Number(row.confidence),
        flags: (row.flags as string[]) ?? [],
        reasons: (row.reasons as string[]) ?? [],
      } as VendorReviewSuggestion;
    }
    setSuggestionsByVendor(map);
  }, []);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('vendors')
      .select('*, users!vendors_user_id_fkey(email, name)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('approval_status', filter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setVendors([]);
    } else {
      const rows = (data as AdminVendorRow[]) ?? [];
      setVendors(rows);
      if (filter === 'pending') {
        await loadSuggestions(rows.map((v) => v.id));
      } else {
        setSuggestionsByVendor({});
      }
    }

    setLoading(false);
  }, [filter, loadSuggestions]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  async function handleRunAiReview() {
    if (!isAdminAgentConfigured()) return;
    setReviewingQueue(true);
    setError(null);
    try {
      await runVendorReviewQueue();
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI review failed.');
    } finally {
      setReviewingQueue(false);
    }
  }

  async function setApproval(vendor: AdminVendorRow, status: ApprovalStatus) {
    if (!user) return;
    setActingId(vendor.id);
    setError(null);

    const { error: updateError } = await supabase
      .from('vendors')
      .update({ approval_status: status, updated_at: new Date().toISOString() })
      .eq('id', vendor.id);

    if (updateError) {
      setError(updateError.message);
      setActingId(null);
      return;
    }

    const suggestion = suggestionsByVendor[vendor.id];
    await recordVendorReviewFeedback({
      vendor,
      adminUserId: user.id,
      adminAction: status === 'approved' ? 'approved' : 'rejected',
      suggestion,
    });

    await loadVendors();
    setActingId(null);
  }

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Vendors</h1>

      {isAdminAgentConfigured() && filter === 'pending' ? (
        <button
          type="button"
          className="app-btn app-btn--secondary"
          style={{ marginBottom: '1rem' }}
          disabled={reviewingQueue}
          onClick={() => void handleRunAiReview()}>
          {reviewingQueue ? 'Running AI review…' : 'Run AI review queue'}
        </button>
      ) : null}

      <div className="app-chip-row" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-chip${filter === item.key ? ' app-chip--selected' : ''}`}
            onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : vendors.length === 0 ? (
        <div className="app-empty">No vendors in this filter.</div>
      ) : (
        <div className="app-list">
          {vendors.map((vendor) => {
            const suggestion = suggestionsByVendor[vendor.id];
            return (
              <div key={vendor.id} className="app-card">
                <div className="app-row">
                  <div className="app-row-body">
                    <Link to={`/admin/vendors/${vendor.id}`} className="app-row-title" style={{ color: 'var(--color-forest)' }}>
                      {vendor.business_name ?? 'Unnamed business'}
                    </Link>
                    <p className="app-row-meta">{vendor.users?.email ?? '—'}</p>
                    <p className="app-row-meta" style={{ textTransform: 'capitalize' }}>{vendor.approval_status}</p>
                  </div>
                </div>

                {suggestion ? (
                  <div className="app-card app-card--honeydew" style={{ marginTop: '0.75rem' }}>
                    <p className="app-row-meta">AI: {RECOMMENDATION_LABEL[suggestion.recommendation]} ({Math.round(suggestion.confidence * 100)}%)</p>
                    <p className="app-row-meta">{suggestion.summary}</p>
                  </div>
                ) : null}

                {vendor.approval_status === 'pending' ? (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="app-btn app-btn--primary app-btn--small"
                      disabled={actingId === vendor.id}
                      onClick={() => void setApproval(vendor, 'approved')}>
                      Approve
                    </button>
                    <button
                      type="button"
                      className="app-btn app-btn--secondary app-btn--small"
                      disabled={actingId === vendor.id}
                      onClick={() => void setApproval(vendor, 'rejected')}>
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
