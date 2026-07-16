export interface PosAnalyticsTransactionRow {
  id: string;
  total_amount_cents: number;
  tax_amount_cents: number;
  tip_amount_cents: number;
  payment_status: string;
  transaction_created_at: string;
}

export interface PosAnalyticsApiResponse {
  vendorId: string;
  rangeDays: number;
  transactions: PosAnalyticsTransactionRow[];
}
