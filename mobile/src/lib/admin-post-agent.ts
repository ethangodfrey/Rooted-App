import { api, isApiConfigured } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';
import type { Post, PostMediaType } from '@/src/types/database';

export type PostModerationRecommendation = 'approve' | 'flag' | 'remove';
export type PostModerationStatus = 'unreviewed' | 'approved' | 'flagged' | 'removed';
export type PostModerationAdminAction = 'approved' | 'flagged' | 'removed';
export type PostModerationFeedbackOutcome = 'accepted' | 'overridden' | 'no_ai_suggestion';

export interface PostModerationSuggestion {
  id: string;
  post_id: string;
  recommendation: PostModerationRecommendation;
  confidence: number;
  summary: string;
  categories: string[];
  flags: string[];
  reasons: string[];
  agent_version: string | null;
  created_at: string;
}

export interface PostModerationAgentRunResult {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  reviewed: number;
  suggestions: number;
  flagged: number;
  approved: number;
  skipped: number;
  errors: string[];
}

export interface PostModerationFeedbackStats {
  total: number;
  accepted: number;
  overridden: number;
  noAiSuggestion: number;
}

export function isPostModerationConfigured(): boolean {
  return isApiConfigured;
}

export function computePostModerationOutcome(
  aiRecommendation: PostModerationRecommendation | null | undefined,
  adminAction: PostModerationAdminAction,
): PostModerationFeedbackOutcome {
  if (!aiRecommendation) return 'no_ai_suggestion';

  const aligned =
    (aiRecommendation === 'approve' && adminAction === 'approved') ||
    (aiRecommendation === 'flag' && adminAction === 'flagged') ||
    (aiRecommendation === 'remove' && adminAction === 'removed');

  return aligned ? 'accepted' : 'overridden';
}

export function buildPostSnapshot(post: Post & { moderation_status?: string }) {
  return {
    caption: post.caption,
    media_type: post.media_type,
    media_url: post.media_url,
    post_type: post.post_type,
    moderation_status: post.moderation_status ?? null,
  };
}

export async function recordPostModerationFeedback(options: {
  post: Post & { moderation_status?: string };
  adminUserId: string;
  adminAction: PostModerationAdminAction;
  suggestion?: PostModerationSuggestion | null;
  categories?: string[];
  notes?: string | null;
}): Promise<void> {
  const { post, adminUserId, adminAction, suggestion, categories, notes } = options;

  const { error } = await supabase.from('post_moderation_feedback').insert({
    suggestion_id: suggestion?.id ?? null,
    post_id: post.id,
    admin_user_id: adminUserId,
    ai_recommendation: suggestion?.recommendation ?? null,
    admin_action: adminAction,
    outcome: computePostModerationOutcome(suggestion?.recommendation, adminAction),
    notes: notes ?? null,
    post_snapshot: {
      ...buildPostSnapshot(post),
      categories: categories ?? suggestion?.categories ?? [],
    },
  });

  if (error) {
    console.warn('Failed to record post moderation feedback:', error.message);
  }
}

export async function runPostModerationQueue(): Promise<PostModerationAgentRunResult> {
  return api.post<PostModerationAgentRunResult>('/admin/posts/moderate');
}

export async function moderatePostWithAi(postId: string): Promise<PostModerationSuggestion> {
  const result = await api.post<{
    suggestionId: string;
    recommendation: PostModerationRecommendation;
    confidence: number;
    summary: string;
    categories: string[];
    flags: string[];
    reasons: string[];
  }>(`/admin/posts/${postId}/moderate`);

  return {
    id: result.suggestionId,
    post_id: postId,
    recommendation: result.recommendation,
    confidence: result.confidence,
    summary: result.summary,
    categories: result.categories,
    flags: result.flags,
    reasons: result.reasons,
    agent_version: null,
    created_at: new Date().toISOString(),
  };
}

export async function fetchPostModerationFeedbackStats(): Promise<PostModerationFeedbackStats | null> {
  if (!isApiConfigured) return null;
  try {
    return await api.get<PostModerationFeedbackStats>('/admin/posts/feedback/stats');
  } catch {
    return null;
  }
}

export const MODERATION_RECOMMENDATION_LABEL: Record<PostModerationRecommendation, string> = {
  approve: 'Looks OK',
  flag: 'Flagged',
  remove: 'Should remove',
};

export const MODERATION_RECOMMENDATION_COLOR: Record<PostModerationRecommendation, string> = {
  approve: 'text-forest',
  flag: 'text-warn',
  remove: 'text-danger',
};

export const MODERATION_STATUS_LABEL: Record<PostModerationStatus, string> = {
  unreviewed: 'Awaiting review',
  approved: 'Approved',
  flagged: 'Flagged',
  removed: 'Removed',
};

export type AdminModerationPost = Post & {
  moderation_status: PostModerationStatus;
  vendor: { id: string; business_name: string | null } | null;
};
