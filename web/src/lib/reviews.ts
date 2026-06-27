import { supabase } from '@/lib/supabase';
import type { Review, ReviewTargetType } from '@/types/database';

export async function fetchApprovedReviews(
  targetType: ReviewTargetType,
  targetId: string,
  limit = 20,
): Promise<{ reviews: Review[]; error: string | null }> {
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('target_type', targetType)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (targetType === 'vendor') {
    query = query.eq('vendor_id', targetId);
  } else if (targetType === 'chef') {
    query = query.eq('chef_id', targetId);
  } else if (targetType === 'service') {
    query = query.eq('service_id', targetId);
  } else {
    query = query.eq('product_id', targetId);
  }

  const { data, error } = await query;
  return {
    reviews: (data ?? []) as Review[],
    error: error?.message ?? null,
  };
}

export async function submitReview(input: {
  targetType: ReviewTargetType;
  targetId: string;
  reviewerId: string;
  overallRating: number;
  reviewTitle?: string;
  reviewText?: string;
  orderId?: string;
  bookingId?: string;
}): Promise<{ review: Review | null; error: string | null }> {
  const row: Record<string, unknown> = {
    reviewer_id: input.reviewerId,
    target_type: input.targetType,
    overall_rating: input.overallRating,
    review_title: input.reviewTitle?.trim() || null,
    review_text: input.reviewText?.trim() || null,
    order_id: input.orderId ?? null,
    booking_id: input.bookingId ?? null,
    moderation_status: 'pending',
  };

  if (input.targetType === 'vendor') {
    row.vendor_id = input.targetId;
  } else if (input.targetType === 'chef') {
    row.chef_id = input.targetId;
  } else if (input.targetType === 'service') {
    row.service_id = input.targetId;
  } else {
    row.product_id = input.targetId;
  }

  const { data, error } = await supabase.from('reviews').insert(row).select('*').maybeSingle();
  return {
    review: (data as Review | null) ?? null,
    error: error?.message ?? null,
  };
}
