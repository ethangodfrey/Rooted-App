import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import {
  isAdminAgentConfigured,
  RECOMMENDATION_LABEL,
  recordVendorReviewFeedback,
  reviewVendorWithAi,
  type VendorReviewSuggestion,
} from '@/lib/admin-agent';
import { supabase } from '@/lib/supabase';
import type { ApprovalStatus, Vendor } from '@/types/database';
import '@/components/ui/ui.css';

type AdminVendorRow = Vendor & {
  users: { email: string | null; name: string | null } | null;
};

export function AdminVendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<AdminVendorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [suggestion, setSuggestion] = useState<VendorReviewSuggestion | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('vendors')
      .select('*, users!vendors_user_id_fkey(email, name)')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !data) {
      setError(fetchError?.message ?? 'Vendor not found.');
      setVendor(null);
    } else {
      setVendor(data as AdminVendorRow);
    }

    const { data: sug } = await supabase
      .from('vendor_review_suggestions')
      .select('id, vendor_id, recommendation, confidence, summary, flags, reasons, agent_version, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sug) {
      setSuggestion({
        ...sug,
        confidence: Number(sug.confidence),
        flags: (sug.flags as string[]) ?? [],
        reasons: (sug.reasons as string[]) ?? [],
      } as VendorReviewSuggestion);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAiReview() {
    if (!id || !isAdminAgentConfigured()) return;
    setReviewing(true);
    setError(null);
    try {
      const result = await reviewVendorWithAi(id);
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI review failed.');
    } finally {
      setReviewing(false);
    }
  }

  async function setApproval(status: ApprovalStatus) {
    if (!vendor || !user) return;
    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('vendors')
      .update({ approval_status: status, updated_at: new Date().toISOString() })
      .eq('id', vendor.id);

    if (updateError) {
      setError(updateError.message);
      setActing(false);
      return;
    }

    await recordVendorReviewFeedback({
      vendor,
      adminUserId: user.id,
      adminAction: status === 'approved' ? 'approved' : 'rejected',
      suggestion,
    });

    navigate('/admin/vendors');
  }

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;
  if (!vendor) return <div className="app-empty">{error ?? 'Not found'}</div>;

  return (
    <div className="app-screen">
      <Link to="/admin/vendors" className="app-back-link">← Vendors</Link>
      <h1 className="app-title">{vendor.business_name ?? 'Vendor'}</h1>
      <p className="app-subtitle" style={{ textTransform: 'capitalize' }}>{vendor.approval_status}</p>

      <div className="app-card" style={{ marginBottom: '1rem' }}>
        <p className="app-row-meta">Email</p>
        <p className="app-row-title">{vendor.users?.email ?? '—'}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Category</p>
        <p className="app-row-title">{vendor.category ?? '—'}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Location</p>
        <p className="app-row-title">{[vendor.sell_city, vendor.sell_state].filter(Boolean).join(', ') || '—'}</p>
        <p className="app-row-meta" style={{ marginTop: '0.75rem' }}>Summary</p>
        <p>{vendor.product_summary ?? vendor.business_description ?? '—'}</p>
      </div>

      {suggestion ? (
        <div className="app-card app-card--honeydew" style={{ marginBottom: '1rem' }}>
          <p className="app-row-title">AI suggestion: {RECOMMENDATION_LABEL[suggestion.recommendation]}</p>
          <p className="app-row-meta">{suggestion.summary}</p>
          {suggestion.reasons.length > 0 ? (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {suggestion.reasons.map((r) => (
                <li key={r} className="app-row-meta">{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : isAdminAgentConfigured() ? (
        <button type="button" className="app-btn app-btn--secondary" style={{ marginBottom: '1rem' }} disabled={reviewing} onClick={() => void handleAiReview()}>
          {reviewing ? 'Reviewing…' : 'Run AI review'}
        </button>
      ) : null}

      {vendor.approval_status === 'pending' ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="app-btn app-btn--primary" disabled={acting} onClick={() => void setApproval('approved')}>Approve</button>
          <button type="button" className="app-btn app-btn--secondary" disabled={acting} onClick={() => void setApproval('rejected')}>Reject</button>
        </div>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}
    </div>
  );
}
