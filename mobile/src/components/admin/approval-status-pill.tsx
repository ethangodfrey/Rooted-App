import { Text } from 'react-native';

import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_STYLE,
} from '@/src/lib/approval-status';
import type { ApprovalStatus } from '@/src/types/database';

export function ApprovalStatusPill({ status }: { status: ApprovalStatus }) {
  return (
    <Text
      className={`overflow-hidden rounded-full px-2.5 py-1 text-xs font-semibold ${APPROVAL_STATUS_STYLE[status]}`}>
      {APPROVAL_STATUS_LABEL[status]}
    </Text>
  );
}
