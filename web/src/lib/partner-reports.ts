import { api } from '@/lib/api';

export type PartnerReportItem = {
  id: string;
  entityId: string;
  entityType: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string;
  metrics: unknown;
  emailStatus: string;
  createdAt: string;
};

export async function fetchPartnerReports(
  limit = 10,
): Promise<{ STATUS: string; ITEMS: PartnerReportItem[]; COUNT: number }> {
  return api.get(
    `/api/intelligence/reports?limit=${encodeURIComponent(String(limit))}`,
  );
}
