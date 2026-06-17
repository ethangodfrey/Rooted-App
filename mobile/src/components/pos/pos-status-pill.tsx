import { View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import type { PosConnectionStatus, PosSyncStatus } from '@/src/types/pos';

type AnyStatus = PosConnectionStatus | PosSyncStatus;

const STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-forest-50', text: 'text-forest', label: 'Active' },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  ERROR: { bg: 'bg-red-50', text: 'text-danger', label: 'Error' },
  EXPIRED: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Expired' },
  DISCONNECTED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Disconnected' },
  QUEUED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Queued' },
  RUNNING: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Running' },
  SUCCESS: { bg: 'bg-forest-50', text: 'text-forest', label: 'Success' },
  PARTIAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partial' },
  FAILED: { bg: 'bg-red-50', text: 'text-danger', label: 'Failed' },
};

export function PosStatusPill({ status }: { status: AnyStatus }) {
  const style = STYLE[status] ?? { bg: 'bg-gray-100', text: 'text-gray-500', label: status };
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${style.bg}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{style.label}</Text>
    </View>
  );
}
