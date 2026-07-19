export type WholesaleInvoiceDisplayStatus = 'PENDING' | 'PAID' | 'OVERDUE';

/** AR badge: PAID, OVERDUE (unpaid past due), else PENDING. */
export function resolveInvoiceDisplayStatus(
  status: string,
  dueAt: Date,
  now: Date = new Date(),
): WholesaleInvoiceDisplayStatus {
  if (status === 'PAID') return 'PAID';
  if (dueAt.getTime() < now.getTime()) return 'OVERDUE';
  return 'PENDING';
}
