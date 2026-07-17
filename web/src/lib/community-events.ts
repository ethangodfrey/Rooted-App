import { api, isApiConfigured } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export const COMMUNITY_EVENT_TYPES = [
  'FESTIVAL',
  'POP_UP',
  'CITY_MARKET',
  'FARMERS_MARKET',
] as const;

export type CommunityEventType = (typeof COMMUNITY_EVENT_TYPES)[number];

export type CommunityEventVerificationStatus = 'pending' | 'approved' | 'rejected';

export type CommunityAiRecommendation = 'approve' | 'reject' | 'needs_review';

export type CommunityEvent = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  event_type: CommunityEventType;
  latitude: number;
  longitude: number;
  start_time: string;
  end_time: string;
  is_ai_ingested: boolean;
  verification_status: CommunityEventVerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  ai_recommendation: CommunityAiRecommendation | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_flags: string[];
  ai_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommunityEventParticipant = {
  profile_id: string;
  display_name: string;
  role: 'vendor' | 'farmer' | null;
};

export type CommunityEventWithParticipants = CommunityEvent & {
  participants: CommunityEventParticipant[];
};

export type CreateCommunityEventInput = {
  creatorId: string;
  title: string;
  description: string;
  eventType: CommunityEventType;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
};

export type CommunityEventAiVerifyResult = {
  eventId: string;
  recommendation: CommunityAiRecommendation;
  confidence: number;
  summary: string;
  flags: string[];
  reasons: string[];
  source: 'rules' | 'openai';
};

const TABLE = 'community_events';
const PARTICIPANTS = 'community_event_participants';

export function isCommunityEventType(value: string): value is CommunityEventType {
  return (COMMUNITY_EVENT_TYPES as readonly string[]).includes(value);
}

export async function fetchActiveCommunityEvents(): Promise<CommunityEvent[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('verification_status', 'approved')
    .gt('end_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  return ((data ?? []) as CommunityEvent[]).map(normalizeCommunityEvent);
}

export async function fetchCommunityEventsForCreator(
  creatorId: string,
): Promise<CommunityEvent[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('creator_id', creatorId)
    .order('start_time', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return ((data ?? []) as CommunityEvent[]).map(normalizeCommunityEvent);
}

export async function fetchCommunityEventsForAdmin(
  filter: 'pending' | 'all' = 'pending',
): Promise<CommunityEvent[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filter === 'pending') {
    query = query.eq('verification_status', 'pending');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as CommunityEvent[]).map(normalizeCommunityEvent);
}

export async function publishCommunityEvent(
  input: CreateCommunityEventInput,
): Promise<CommunityEvent> {
  const title = input.title.trim();
  if (!title) throw new Error('Title is required');
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('Valid latitude and longitude are required');
  }
  if (new Date(input.endTime) <= new Date(input.startTime)) {
    throw new Error('End time must be after start time');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      creator_id: input.creatorId,
      title,
      description: input.description.trim(),
      event_type: input.eventType,
      latitude: input.latitude,
      longitude: input.longitude,
      start_time: input.startTime,
      end_time: input.endTime,
      is_ai_ingested: false,
      verification_status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return normalizeCommunityEvent(data as CommunityEvent);
}

export async function approveCommunityEvent(
  eventId: string,
  adminUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      verification_status: 'approved',
      verified_at: new Date().toISOString(),
      verified_by: adminUserId,
      rejection_reason: null,
    })
    .eq('id', eventId);

  if (error) throw new Error(error.message);
}

export async function rejectCommunityEvent(
  eventId: string,
  adminUserId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      verification_status: 'rejected',
      verified_at: new Date().toISOString(),
      verified_by: adminUserId,
      rejection_reason: reason?.trim() || null,
    })
    .eq('id', eventId);

  if (error) throw new Error(error.message);
}

export async function runCommunityEventAiVerify(
  eventId: string,
): Promise<CommunityEventAiVerifyResult> {
  if (!isApiConfigured) {
    throw new Error('Backend API is not configured for AI verification.');
  }
  return api.post<CommunityEventAiVerifyResult>(
    `/admin/community-events/${eventId}/verify`,
  );
}

export async function fetchParticipantsForEvents(
  eventIds: string[],
): Promise<Record<string, CommunityEventParticipant[]>> {
  const unique = [...new Set(eventIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data: rows, error } = await supabase
    .from(PARTICIPANTS)
    .select('community_event_id, profile_id')
    .in('community_event_id', unique);

  if (error) throw new Error(error.message);

  const profileIds = [...new Set((rows ?? []).map((r) => r.profile_id as string))];
  if (profileIds.length === 0) return {};

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', profileIds);

  const { data: vendors } = await supabase
    .from('vendors')
    .select('user_id, business_name')
    .in('user_id', profileIds);

  const { data: farmers } = await supabase
    .from('farmers')
    .select('user_id, farm_name')
    .in('user_id', profileIds);

  const vendorName = new Map(
    (vendors ?? []).map((v) => [v.user_id as string, v.business_name as string | null]),
  );
  const farmerName = new Map(
    (farmers ?? []).map((f) => [f.user_id as string, f.farm_name as string | null]),
  );
  const roleById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.role as string | null) ?? null]),
  );

  const out: Record<string, CommunityEventParticipant[]> = {};
  for (const row of rows ?? []) {
    const eventId = row.community_event_id as string;
    const profileId = row.profile_id as string;
    const roleRaw = roleById.get(profileId);
    const role = roleRaw === 'farmer' || roleRaw === 'vendor' ? roleRaw : null;
    const displayName =
      vendorName.get(profileId) ||
      farmerName.get(profileId) ||
      (role === 'farmer' ? 'Farmer' : 'Vendor');

    if (!out[eventId]) out[eventId] = [];
    out[eventId].push({ profile_id: profileId, display_name: displayName, role });
  }
  return out;
}

export async function fetchActiveCommunityEventsWithParticipants(): Promise<
  CommunityEventWithParticipants[]
> {
  const events = await fetchActiveCommunityEvents();
  const byEvent = await fetchParticipantsForEvents(events.map((e) => e.id));
  return events.map((event) => ({
    ...event,
    participants: byEvent[event.id] ?? [],
  }));
}

function normalizeCommunityEvent(row: CommunityEvent): CommunityEvent {
  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    description: row.description ?? '',
    is_ai_ingested: Boolean(row.is_ai_ingested),
    verification_status: row.verification_status ?? 'pending',
    verified_at: row.verified_at ?? null,
    verified_by: row.verified_by ?? null,
    rejection_reason: row.rejection_reason ?? null,
    ai_recommendation: row.ai_recommendation ?? null,
    ai_confidence:
      row.ai_confidence == null ? null : Number(row.ai_confidence),
    ai_summary: row.ai_summary ?? null,
    ai_flags: row.ai_flags ?? [],
    ai_reviewed_at: row.ai_reviewed_at ?? null,
  };
}
