import { Text } from 'react-native';

import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '@/src/lib/order-status';
import type { OrderStatus } from '@/src/types/database';

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <Text
      className={`rounded-full px-3 py-1 text-xs font-medium ${ORDER_STATUS_STYLE[status]}`}>
      {ORDER_STATUS_LABEL[status]}
    </Text>
  );
}
