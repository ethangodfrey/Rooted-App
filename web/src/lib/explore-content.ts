import { supabase } from '@/lib/supabase';
import type { ExploreContent, ExploreContentType } from '@/types/database';

export const EXPLORE_CONTENT_TYPES: ExploreContentType[] = [
  'portfolio',
  'menu_highlight',
  'behind_scenes',
  'recipe',
  'promotion',
  'announcement',
];

export const EXPLORE_CONTENT_TYPE_LABEL: Record<ExploreContentType, string> = {
  portfolio: 'Portfolio',
  menu_highlight: 'Menu highlight',
  behind_scenes: 'Behind the scenes',
  recipe: 'Recipe',
  promotion: 'Promotion',
  announcement: 'Announcement',
};

export interface ExploreContentInput {
  content_type: ExploreContentType;
  title: string | null;
  caption: string | null;
  media_urls: string[];
  tags: string[];
  linked_product_id?: string | null;
  linked_service_id?: string | null;
}

export type ExploreCreator =
  | { creatorType: 'vendor'; vendorId: string }
  | { creatorType: 'chef'; chefId: string };

/** Fetch the public explore feed across all creators, newest first. */
export async function fetchExploreFeed(limit = 40): Promise<ExploreContent[]> {
  const { data } = await supabase
    .from('explore_content')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ExploreContent[];
}

/** Fetch a single creator's showcase posts, newest first. */
export async function fetchExploreContentForCreator(
  creator: ExploreCreator,
): Promise<ExploreContent[]> {
  const query = supabase
    .from('explore_content')
    .select('*')
    .order('created_at', { ascending: false });

  const { data } =
    creator.creatorType === 'vendor'
      ? await query.eq('vendor_id', creator.vendorId)
      : await query.eq('chef_id', creator.chefId);

  return (data ?? []) as ExploreContent[];
}

/** Insert a new showcase post for a vendor or chef. */
export async function createExploreContent(
  creator: ExploreCreator,
  input: ExploreContentInput,
): Promise<ExploreContent> {
  const row = {
    creator_type: creator.creatorType,
    vendor_id: creator.creatorType === 'vendor' ? creator.vendorId : null,
    chef_id: creator.creatorType === 'chef' ? creator.chefId : null,
    content_type: input.content_type,
    title: input.title,
    caption: input.caption,
    media_urls: input.media_urls,
    tags: input.tags,
    linked_product_id: input.linked_product_id ?? null,
    linked_service_id: input.linked_service_id ?? null,
  };

  const { data, error } = await supabase
    .from('explore_content')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data as ExploreContent;
}

/** Remove a showcase post the creator owns (RLS enforces ownership). */
export async function deleteExploreContent(id: string): Promise<void> {
  const { error } = await supabase.from('explore_content').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Resolves the customer-facing destination for a showcase post: a linked
 * product when present, otherwise the creator's profile.
 */
export function resolveExploreContentHref(item: ExploreContent): string | null {
  if (item.linked_product_id) {
    return `/shopper/products/${item.linked_product_id}`;
  }
  if (item.creator_type === 'vendor' && item.vendor_id) {
    return `/shopper/vendors/${item.vendor_id}`;
  }
  if (item.creator_type === 'chef' && item.chef_id) {
    return `/shopper/chefs/${item.chef_id}`;
  }
  return null;
}
