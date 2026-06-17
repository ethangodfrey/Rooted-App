import { api, isApiConfigured } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/types/database';

export type VendorReviewRecommendation = 'approve' | 'reject' | 'needs_review';
export type AdminReviewAction = 'approved' | 'rejected';
export type ReviewFeedbackOutcome = 'accepted' | 'overridden' | 'no_ai_suggestion';

export interface VendorReviewSuggestion {
  id: string;
  vendor_id: string;
  recommendation: VendorReviewRecommendation;
  confidence: number;
  summary: string;
  flags: string[];
  reasons: string[];
  agent_version: string | null;
  created_at: string;
}

export interface AdminAgentRunResult {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  reviewed: number;
  suggestions: number;
  skipped: number;
  errors: string[];
}

export function isAdminAgentConfigured(): boolean {
  return isApiConfigured;
}

export function computeReviewOutcome(
  aiRecommendation: VendorReviewRecommendation | null | undefined,
  adminAction: AdminReviewAction,
): ReviewFeedbackOutcome {
  if (!aiRecommendation) return 'no_ai_suggestion';
  if (aiRecommendation === 'needs_review') return 'overridden';
  if (aiRecommendation === 'approve' && adminAction === 'approved') return 'accepted';
  if (aiRecommendation === 'reject' && adminAction === 'rejected') return 'accepted';
  return 'overridden';
}

export function buildVendorSnapshot(vendor: Vendor) {
  return {
    business_name: vendor.business_name,
    category: vendor.category,
    product_summary: vendor.product_summary,
    sell_city: vendor.sell_city,
    sell_state: vendor.sell_state,
    selling_channels: vendor.selling_channels ?? [],
    instagram_url: vendor.instagram_url,
    website_url: vendor.website_url,
    primary_market: vendor.primary_market,
  };
}

export async function recordVendorReviewFeedback(options: {
  vendor: Vendor;
  adminUserId: string;
  adminAction: AdminReviewAction;
  suggestion?: VendorReviewSuggestion | null;
  notes?: string | null;
}): Promise<void> {
  const { vendor, adminUserId, adminAction, suggestion, notes } = options;
  const aiRecommendation = suggestion?.recommendation ?? null;

  const { error } = await supabase.from('vendor_review_feedback').insert({
    suggestion_id: suggestion?.id ?? null,
    vendor_id: vendor.id,
    admin_user_id: adminUserId,
    ai_recommendation: aiRecommendation,
    admin_action: adminAction,
    outcome: computeReviewOutcome(aiRecommendation, adminAction),
    notes: notes ?? null,
    vendor_snapshot: buildVendorSnapshot(vendor),
  });

  if (error) {
    console.warn('Failed to record vendor review feedback:', error.message);
  }
}

export async function runVendorReviewQueue(): Promise<AdminAgentRunResult> {
  return api.post<AdminAgentRunResult>('/admin/vendors/review');
}

export async function reviewVendorWithAi(vendorId: string): Promise<VendorReviewSuggestion> {
  const result = await api.post<{
    suggestionId: string;
    recommendation: VendorReviewRecommendation;
    confidence: number;
    summary: string;
    flags: string[];
    reasons: string[];
  }>(`/admin/vendors/${vendorId}/review`);

  return {
    id: result.suggestionId,
    vendor_id: vendorId,
    recommendation: result.recommendation,
    confidence: result.confidence,
    summary: result.summary,
    flags: result.flags,
    reasons: result.reasons,
    agent_version: null,
    created_at: new Date().toISOString(),
  };
}

export const RECOMMENDATION_LABEL: Record<VendorReviewRecommendation, string> = {
  approve: 'Likely approve',
  reject: 'Likely reject',
  needs_review: 'Needs review',
};
