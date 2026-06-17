export type PostModerationRecommendation = 'approve' | 'flag' | 'remove';

export type PostModerationCategory =
  | 'spam'
  | 'harassment'
  | 'explicit'
  | 'violence'
  | 'illegal'
  | 'misleading'
  | 'off_topic'
  | 'none';

export interface PostModerationProfile {
  id: string;
  vendorId: string;
  vendorName: string | null;
  postType: string;
  caption: string;
  mediaUrl: string | null;
  mediaType: string;
  videoThumbnailUrl: string | null;
  publishAt: Date;
  createdAt: Date;
}

export interface PostModerationResult {
  recommendation: PostModerationRecommendation;
  confidence: number;
  summary: string;
  categories: PostModerationCategory[];
  flags: string[];
  reasons: string[];
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

export type PostModerationAdminAction = 'approved' | 'flagged' | 'removed';
export type PostModerationFeedbackOutcome = 'accepted' | 'overridden' | 'no_ai_suggestion';

export interface PostModerationFeedbackExample {
  outcome: PostModerationFeedbackOutcome;
  aiRecommendation: PostModerationRecommendation | null;
  adminAction: PostModerationAdminAction;
  caption: string | null;
  mediaType: string | null;
  categories: string[];
  notes: string | null;
}

export const POST_MODERATION_AGENT_VERSION = '1.0.0';
