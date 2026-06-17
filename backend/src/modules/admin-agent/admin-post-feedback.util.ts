import type {
  PostModerationAdminAction,
  PostModerationRecommendation,
  PostModerationFeedbackOutcome,
} from './admin-post.types';

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

export function moderationStatusForAiRecommendation(
  recommendation: PostModerationRecommendation,
): 'approved' | 'flagged' | 'removed' {
  if (recommendation === 'approve') return 'approved';
  if (recommendation === 'remove') return 'flagged';
  return 'flagged';
}
