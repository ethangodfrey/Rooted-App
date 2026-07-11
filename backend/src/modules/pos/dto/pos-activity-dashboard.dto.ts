export const POS_ACTIVITY_WINDOW_HOURS = 24;

/** In-person units at or below this threshold trigger a low-stock alert. */
export const LOW_STOCK_THRESHOLD = 5;

export interface PosActivityFeedItem {
  id: string;
  kind: 'inventory_adjustment' | 'pos_sale' | 'sync_run';
  message: string;
  productName: string | null;
  eventName: string | null;
  provider: string | null;
  quantity: number | null;
  stockLevel: number | null;
  occurredAt: string;
}

export interface PosLowStockAlert {
  productId: string;
  productName: string;
  eventId: string;
  eventName: string;
  quantityRemaining: number;
  provider: string | null;
  lastChangeAt: string;
}

export interface PosActivityDashboardMetrics {
  windowHours: number;
  totalSyncsProcessed: number;
  inventorySyncEvents: number;
  transactionSyncRuns: number;
  activePosTerminals: number;
  lowStockAlertCount: number;
  queueLatencyMs: number | null;
  queueLatencySampleSize: number;
  lastUpdatedAt: string;
}

export interface PosActivityDashboardResponse {
  metrics: PosActivityDashboardMetrics;
  lowStockAlerts: PosLowStockAlert[];
  feed: PosActivityFeedItem[];
}
