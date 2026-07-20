/**
 * Phase 15a — monthly RANGE partitioning strategy for orders / order_items.
 * Telemetry: PARTITIONING_STRATEGY_APPLIED
 */

export const ORDERS_PARTITION_KEY = 'created_at' as const;
export const ORDERS_PARTITION_INTERVAL = 'monthly' as const;

export type PartitionedOrdersTable = 'orders' | 'order_items';

export type PartitionStrategy = {
  tableName: PartitionedOrdersTable;
  method: 'RANGE';
  partitionKey: typeof ORDERS_PARTITION_KEY;
  primaryKeyColumns: readonly ['id', 'created_at'];
  interval: typeof ORDERS_PARTITION_INTERVAL;
};

export const ORDERS_PARTITION_STRATEGIES: readonly PartitionStrategy[] = [
  {
    tableName: 'orders',
    method: 'RANGE',
    partitionKey: ORDERS_PARTITION_KEY,
    primaryKeyColumns: ['id', 'created_at'],
    interval: ORDERS_PARTITION_INTERVAL,
  },
  {
    tableName: 'order_items',
    method: 'RANGE',
    partitionKey: ORDERS_PARTITION_KEY,
    primaryKeyColumns: ['id', 'created_at'],
    interval: ORDERS_PARTITION_INTERVAL,
  },
] as const;

export function partitionSuffixForMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `y${year}m${month}`;
}

export function monthlyPartitionBounds(date: Date): {
  start: Date;
  end: Date;
  suffix: string;
} {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return {
    start,
    end,
    suffix: partitionSuffixForMonth(date),
  };
}

export function assertPartitionStrategyValid(
  strategies: readonly PartitionStrategy[] = ORDERS_PARTITION_STRATEGIES,
): void {
  for (const strategy of strategies) {
    if (strategy.method !== 'RANGE') {
      throw new Error(`PARTITION_STRATEGY_INVALID METHOD=${strategy.method}`);
    }
    if (strategy.partitionKey !== 'created_at') {
      throw new Error(
        `PARTITION_STRATEGY_INVALID KEY=${strategy.partitionKey}`,
      );
    }
    if (
      strategy.primaryKeyColumns.length !== 2 ||
      strategy.primaryKeyColumns[0] !== 'id' ||
      strategy.primaryKeyColumns[1] !== 'created_at'
    ) {
      throw new Error(
        `PARTITION_STRATEGY_INVALID PK=${strategy.primaryKeyColumns.join(',')}`,
      );
    }
    if (!strategy.primaryKeyColumns.includes(strategy.partitionKey)) {
      throw new Error(
        `PARTITION_STRATEGY_INVALID PK_MISSING_PARTITION_KEY TABLE=${strategy.tableName}`,
      );
    }
  }
}

export function formatPartitionStrategyAppliedLog(
  tableName: PartitionedOrdersTable,
): string {
  return `PARTITIONING_STRATEGY_APPLIED TABLE=${tableName} KEY=${ORDERS_PARTITION_KEY} INTERVAL=${ORDERS_PARTITION_INTERVAL} PK=id,created_at`;
}
