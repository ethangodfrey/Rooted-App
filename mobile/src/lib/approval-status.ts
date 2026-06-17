import type { ApprovalStatus } from '@/src/types/database';

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const APPROVAL_STATUS_STYLE: Record<ApprovalStatus, string> = {
  pending: 'bg-honeydew text-warn',
  approved: 'bg-honeydew text-primary',
  rejected: 'bg-honeydew text-danger',
};
