import { firstRelation } from '@/src/lib/supabase-relations';
import { supabase } from '@/src/lib/supabase';
import type { ExploreContent, ExploreContentType } from '@/src/types/database';

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

/** A showcase post enriched with its creator's display name and avatar. */
export interface ExploreFeedItem extends ExploreContent {
  creatorName: string | null;
  creatorAvatarUrl: string | null;
}

type VendorCreatorEmbed = { business_name: string | null; logo_url: string | null };
type ChefCreatorEmbed = { display_name: string | null; profile_photo_url: string | null };

const EXPLORE_FEED_SELECT =
  '*, vendor:vendors(business_name, logo_url), chef:chefs(display_name, profile_photo_url)';

function normalizeFeedItem(row: unknown): ExploreFeedItem {
  const raw = row as ExploreContent & {
    vendor?: VendorCreatorEmbed | VendorCreatorEmbed[] | null;
    chef?: ChefCreatorEmbed | ChefCreatorEmbed[] | null;
  };
  const vendor = firstRelation(raw.vendor);
  const chef = firstRelation(raw.chef);
  const creatorName =
    raw.creator_type === 'chef'
      ? chef?.display_name ?? null
      : vendor?.business_name ?? null;
  const creatorAvatarUrl =
    raw.creator_type === 'chef'
      ? chef?.profile_photo_url ?? null
      : vendor?.logo_url ?? null;
  return { ...(raw as ExploreContent), creatorName, creatorAvatarUrl };
}

/**
 * Fetch the public showcase feed, newest first, with each post's creator
 * (vendor business or chef) joined for name + avatar attribution.
 */
export async function fetchExploreFeed(limit = 50): Promise<ExploreFeedItem[]> {
  const { data } = await supabase
    .from('explore_content')
    .select(EXPLORE_FEED_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown[]).map(normalizeFeedItem);
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
 * product/service when present, otherwise the creator's profile.
 */
export function resolveExploreContentHref(item: ExploreContent): string | null {
  if (item.linked_product_id) {
    return `/(shopper)/products/${item.linked_product_id}`;
  }
  if (item.linked_service_id) {
    return `/(shopper)/chefs/book/${item.linked_service_id}`;
  }
  if (item.creator_type === 'vendor' && item.vendor_id) {
    return `/(shopper)/vendors/${item.vendor_id}`;
  }
  if (item.creator_type === 'chef' && item.chef_id) {
    return `/(shopper)/chefs/${item.chef_id}`;
  }
  return null;
}
