import { api } from '@/lib/api';

export type DualPostingMode = 'SELF' | 'PARTNERSHIP';
export type DualContributorType = 'FARMER' | 'VENDOR';
export type DualContentKind = 'text' | 'image' | 'video' | 'photo';

export type CreateContributionPayload = {
  caption: string;
  postingMode?: DualPostingMode;
  contentKind?: DualContentKind;
  mediaUrl?: string | null;
  partnerId?: string | null;
  partnerType?: DualContributorType | null;
  partnershipConnectionId?: string | null;
  authorType?: DualContributorType;
  postType?: string;
};

export type CreateContributionResponse = {
  STATUS: string;
  POST_ID: string;
  NOTIFIED_PARTNER: boolean;
  CDN_MEDIA_URL: string | null;
  METADATA: {
    parties: Array<{
      contributorId: string;
      contributorType: DualContributorType;
      role: 'AUTHOR' | 'PARTNER';
    }>;
    postingMode: DualPostingMode;
    contentType: 'TEXT' | 'PHOTO' | 'VIDEO';
    coApprovalStatus: string;
  };
};

export type PartnerActionPayload = {
  postId: string;
  action: 'CO_APPROVE' | 'APPEND' | 'REJECT';
  body?: string | null;
  mediaUrl?: string | null;
  contentKind?: DualContentKind;
  partnerType?: DualContributorType;
};

export async function createContentContribution(
  payload: CreateContributionPayload,
): Promise<CreateContributionResponse> {
  return api.post<CreateContributionResponse>('/api/content/contributions', payload);
}

export async function submitPartnerContributionAction(
  payload: PartnerActionPayload,
): Promise<{ STATUS: string }> {
  return api.post('/api/content/contributions/partner-action', payload);
}
