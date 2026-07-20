import { api } from '@/lib/api';

export type EngagementSeriesPoint = {
  date: string;
  count: number;
};

export type EngagementAnalyticsSummary = {
  STATUS: string;
  ENTITY_ID: string;
  ENTITY_TYPE: 'FARMER' | 'VENDOR';
  DAYS: number;
  TOTALS: {
    views: number;
    inquiries: number;
    rsvps: number;
    collaborations: number;
    postReach: number;
  };
  SERIES: {
    POST_REACH: EngagementSeriesPoint[];
    INQUIRIES: EngagementSeriesPoint[];
    RSVPS: EngagementSeriesPoint[];
  };
  POSTS: {
    COUNT: number;
    PARTNERSHIP_COUNT: number;
    VIEW_COUNT: number;
    CLICK_COUNT: number;
  };
  CATERING: {
    INQUIRY_COUNT: number;
    OPEN_COUNT: number;
  };
  COLLABORATIONS: {
    COUNT: number;
  };
};

export async function fetchEngagementAnalyticsSummary(
  days = 30,
): Promise<EngagementAnalyticsSummary> {
  return api.get<EngagementAnalyticsSummary>(
    `/api/analytics/summary?days=${encodeURIComponent(String(days))}`,
  );
}
