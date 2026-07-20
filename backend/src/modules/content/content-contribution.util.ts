/**
 * Dual-posting attribution + partnership metadata helpers.
 * Telemetry: DUAL_POSTING_INTERFACE_INITIALIZED, CONTENT_CONTRIBUTION_SYNCED
 */

export type ContributorType = 'FARMER' | 'VENDOR';
export type DualContentType = 'TEXT' | 'PHOTO' | 'VIDEO';
export type PostingMode = 'SELF' | 'PARTNERSHIP';
export type CoApprovalStatus =
  | 'NONE'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPENDED';

export type ContributionParty = {
  contributorId: string;
  contributorType: ContributorType;
  role: 'AUTHOR' | 'PARTNER';
};

export type DualContributionMetadata = {
  parties: ContributionParty[];
  postingMode: PostingMode;
  contentType: DualContentType;
  partnershipConnectionId: string | null;
  coApprovalStatus: CoApprovalStatus;
  mediaCompressed: boolean;
  cdnMediaUrl: string | null;
};

export type CreateDualContributionInput = {
  authorId: string;
  authorType: ContributorType;
  contentType: DualContentType;
  postingMode: PostingMode;
  partnerId?: string | null;
  partnerType?: ContributorType | null;
  partnershipConnectionId?: string | null;
  mediaUrl?: string | null;
  cdnMediaUrl?: string | null;
  mediaCompressed?: boolean;
  caption?: string;
};

export function buildDualContributionMetadata(
  input: CreateDualContributionInput,
): DualContributionMetadata {
  const parties: ContributionParty[] = [
    {
      contributorId: input.authorId,
      contributorType: input.authorType,
      role: 'AUTHOR',
    },
  ];

  const partnership =
    input.postingMode === 'PARTNERSHIP' &&
    Boolean(input.partnerId) &&
    Boolean(input.partnerType);

  if (partnership) {
    parties.push({
      contributorId: input.partnerId!,
      contributorType: input.partnerType!,
      role: 'PARTNER',
    });
  }

  return {
    parties,
    postingMode: input.postingMode,
    contentType: input.contentType,
    partnershipConnectionId: partnership
      ? (input.partnershipConnectionId ?? null)
      : null,
    coApprovalStatus: partnership ? 'PENDING' : 'NONE',
    mediaCompressed: Boolean(input.mediaCompressed),
    cdnMediaUrl: input.cdnMediaUrl ?? null,
  };
}

export function assertDualAttribution(metadata: DualContributionMetadata): void {
  if (metadata.parties.length < 1) {
    throw new Error('DUAL_POSTING_FAIL NO_PARTIES');
  }
  const author = metadata.parties.find((p) => p.role === 'AUTHOR');
  if (!author) {
    throw new Error('DUAL_POSTING_FAIL MISSING_AUTHOR');
  }
  if (metadata.postingMode === 'PARTNERSHIP') {
    if (metadata.parties.length !== 2) {
      throw new Error(
        `DUAL_POSTING_FAIL PARTNERSHIP_PARTY_COUNT=${metadata.parties.length}`,
      );
    }
    const partner = metadata.parties.find((p) => p.role === 'PARTNER');
    if (!partner) {
      throw new Error('DUAL_POSTING_FAIL MISSING_PARTNER');
    }
    if (partner.contributorId === author.contributorId) {
      throw new Error('DUAL_POSTING_FAIL SELF_PARTNER');
    }
    if (metadata.coApprovalStatus !== 'PENDING') {
      throw new Error(
        `DUAL_POSTING_FAIL CO_APPROVAL=${metadata.coApprovalStatus}`,
      );
    }
  }
}

export function formatDualPostingInitializedLog(): string {
  return 'DUAL_POSTING_INTERFACE_INITIALIZED SERVICE=ContentContributionService MODES=SELF,PARTNERSHIP';
}

export function formatContentContributionSyncedLog(input: {
  postId: string;
  authorId: string;
  partnerId?: string | null;
  contentType: DualContentType;
  postingMode: PostingMode;
}): string {
  return `CONTENT_CONTRIBUTION_SYNCED POST=${input.postId} AUTHOR=${input.authorId} PARTNER=${input.partnerId ?? 'NONE'} CONTENT_TYPE=${input.contentType} MODE=${input.postingMode}`;
}

export function mapMediaKindToContentType(
  kind: 'text' | 'image' | 'video' | 'photo',
): DualContentType {
  if (kind === 'video') return 'VIDEO';
  if (kind === 'image' || kind === 'photo') return 'PHOTO';
  return 'TEXT';
}
