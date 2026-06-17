export type VendorReviewRecommendation = 'approve' | 'reject' | 'needs_review';

export interface VendorApplicationProfile {
  id: string;
  businessName: string | null;
  businessDescription: string | null;
  category: string | null;
  productSummary: string | null;
  sellCity: string | null;
  sellState: string | null;
  sellingChannels: string[];
  primaryMarket: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  applicationSubmittedAt: Date | null;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
}

export interface VendorReviewResult {
  recommendation: VendorReviewRecommendation;
  confidence: number;
  summary: string;
  flags: string[];
  reasons: string[];
}

export interface AdminAgentRunResult {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  reviewed: number;
  suggestions: number;
  skipped: number;
  errors: string[];
}

export interface VendorReviewFeedbackExample {
  outcome: ReviewFeedbackOutcome;
  aiRecommendation: VendorReviewRecommendation | null;
  adminAction: AdminReviewAction;
  category: string | null;
  productSummary: string | null;
  sellCity: string | null;
  sellState: string | null;
  sellingChannels: string[];
  notes: string | null;
}

export type AdminReviewAction = 'approved' | 'rejected';
export type ReviewFeedbackOutcome = 'accepted' | 'overridden' | 'no_ai_suggestion';

export const ADMIN_AGENT_VERSION = '1.1.0';
