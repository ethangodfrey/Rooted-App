import { api } from '@/lib/api';

export type MakerFeedItem = {
  postId: string;
  vendorId: string;
  eventId: string | null;
  caption: string;
  mediaUrl: string | null;
  cdnMediaUrl: string | null;
  mediaType: string;
  contentType: string;
  vendorName: string | null;
  partnerName: string | null;
  eventName: string | null;
  distanceKm: number | null;
  categoryScore: number;
  rankScore: number;
  preferredCategoryHits: string[];
  coApprovalStatus: string;
  publishAt: string;
};

export type MeetTheMakersFeedResponse = {
  STATUS: string;
  ITEMS: MakerFeedItem[];
  ALERT_RADIUS_KM: number;
  COUNT: number;
};

export type JointContentItem = {
  postId: string;
  caption: string;
  mediaUrl: string | null;
  cdnMediaUrl: string | null;
  publishAt: string;
  contributorType: string | null;
  partnerContributorType: string | null;
};

export type CollaborationResponse = {
  STATUS: string;
  ACTIVE_COLLABORATION: boolean;
  ITEMS: JointContentItem[];
};

export type ScheduleItem = {
  id: string;
  eventId: string;
  postId: string | null;
  status: string;
  createdAt: string;
  eventName?: string | null;
  eventStart?: string | null;
};

export async function fetchMeetTheMakersFeed(options: {
  latitude?: number | null;
  longitude?: number | null;
  alertRadiusKm?: number | null;
  categories?: string[];
  limit?: number;
}): Promise<MeetTheMakersFeedResponse> {
  const params = new URLSearchParams();
  if (options.latitude != null) params.set('latitude', String(options.latitude));
  if (options.longitude != null) params.set('longitude', String(options.longitude));
  if (options.alertRadiusKm != null) {
    params.set('alertRadiusKm', String(options.alertRadiusKm));
  }
  if (options.categories && options.categories.length > 0) {
    params.set('categories', options.categories.join(','));
  }
  if (options.limit != null) params.set('limit', String(options.limit));
  const qs = params.toString();
  return api.get<MeetTheMakersFeedResponse>(
    `/api/discovery/meet-the-makers${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchCollaboration(
  profileId: string,
): Promise<CollaborationResponse> {
  return api.get<CollaborationResponse>(
    `/api/discovery/meet-the-makers/collaboration/${profileId}`,
  );
}

export async function rsvpToMakerEvent(input: {
  eventId: string;
  postId?: string | null;
}): Promise<{ STATUS: string }> {
  return api.post('/api/discovery/meet-the-makers/rsvp', input);
}

export async function cancelMakerRsvp(eventId: string): Promise<{ STATUS: string }> {
  return api.del(`/api/discovery/meet-the-makers/rsvp/${eventId}`);
}

export async function fetchPersonalSchedule(): Promise<{
  STATUS: string;
  ITEMS: ScheduleItem[];
  COUNT: number;
}> {
  return api.get('/api/discovery/schedule');
}
