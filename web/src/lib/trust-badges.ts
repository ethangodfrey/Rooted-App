import { supabase } from '@/lib/supabase';
import type { TrustBadge } from '@/types/database';

/** A trust badge that has been awarded to a user, with its (optional) expiry. */
export type AwardedBadge = TrustBadge & { earned_at: string; expires_at: string | null };

/** Fallback labels when a badge definition is missing `badge_name`. */
const BADGE_TYPE_LABELS: Record<string, string> = {
  identity_verified: 'Identity verified',
  food_safety_certified: 'Food safety certified',
  top_rated: 'Top rated',
  quick_responder: 'Quick responder',
  established_seller: 'Established seller',
};

export function badgeLabel(badge: Pick<TrustBadge, 'badge_type' | 'badge_name'>): string {
  return (
    badge.badge_name?.trim() ||
    BADGE_TYPE_LABELS[badge.badge_type] ||
    badge.badge_type.replace(/_/g, ' ')
  );
}

/**
 * Loads the public trust badges awarded to a user via `user_badges` → `trust_badges`.
 * Expired badges (`expires_at` in the past) are filtered out.
 */
export async function fetchAwardedBadges(userId: string): Promise<AwardedBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('earned_at, expires_at, trust_badges:badge_id(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });

  if (error || !data) return [];

  const now = Date.now();
  const badges: AwardedBadge[] = [];
  for (const row of data as unknown as {
    earned_at: string;
    expires_at: string | null;
    trust_badges: TrustBadge | null;
  }[]) {
    const badge = row.trust_badges;
    if (!badge) continue;
    if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
    badges.push({ ...badge, earned_at: row.earned_at, expires_at: row.expires_at });
  }
  return badges;
}
