import type {
  AdminReviewAction,
  ReviewFeedbackOutcome,
  VendorReviewRecommendation,
} from './admin-agent.types';

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
