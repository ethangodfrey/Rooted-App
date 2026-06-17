import { isTrustedMediaUrl, pickProductDisplayImage } from '@/src/lib/product-image';
import { firstRelation } from '@/src/lib/supabase-relations';
import { supabase } from '@/src/lib/supabase';

export interface SuggestedProduct {
  id: string;
  name: string;
  price: number;
  category: string | null;
  matchedInterest: string;
  displayImageUrl: string | null;
  vendor: {
    business_name: string | null;
    category: string | null;
    sell_city: string | null;
    sell_state: string | null;
    logo_url: string | null;
  } | null;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  media_urls: string[];
  category: string | null;
  created_at: string;
  vendor: {
    business_name: string | null;
    category: string | null;
    sell_city: string | null;
    sell_state: string | null;
    logo_url: string | null;
    approval_status: string;
  } | null;
}

export interface SuggestedProductsContext {
  userCity?: string | null;
  userState?: string | null;
}

function normalizeState(state: string | null | undefined): string | null {
  return state?.trim().toUpperCase() ?? null;
}

function normalizeCity(city: string | null | undefined): string | null {
  return city?.trim().toLowerCase() ?? null;
}

function matchInterest(
  interests: string[],
  productCategory: string | null,
  vendorCategory: string | null,
): string | null {
  if (productCategory && interests.includes(productCategory)) return productCategory;
  if (vendorCategory && interests.includes(vendorCategory)) return vendorCategory;
  return null;
}

function scoreProduct(
  row: ProductRow,
  interests: string[],
  userCity: string | null,
  userState: string | null,
): { score: number; matchedInterest: string } | null {
  const matched = matchInterest(interests, row.category, row.vendor?.category ?? null);
  if (!matched) return null;

  let score = row.category === matched ? 3 : 2;
  const displayImageUrl = pickProductDisplayImage({
    mediaUrls: row.media_urls,
    vendorLogoUrl: row.vendor?.logo_url,
  });
  const hasProductPhoto = (row.media_urls ?? []).some((url) => isTrustedMediaUrl(url));
  if (hasProductPhoto) score += 2;
  else if (displayImageUrl) score += 0.5;
  const vendorCity = normalizeCity(row.vendor?.sell_city);
  const vendorState = normalizeState(row.vendor?.sell_state);
  if (userCity && vendorCity && userCity === vendorCity) score += 1;
  else if (userState && vendorState && userState === vendorState) score += 0.5;

  return { score, matchedInterest: matched };
}

export function rankSuggestedProducts(
  rows: ProductRow[],
  interests: string[],
  context: SuggestedProductsContext = {},
): SuggestedProduct[] {
  if (interests.length === 0) return [];

  const userCity = normalizeCity(context.userCity);
  const userState = normalizeState(context.userState);

  return rows
    .filter((row) => row.vendor?.approval_status === 'approved')
    .map((row) => {
      const scored = scoreProduct(row, interests, userCity, userState);
      if (!scored) return null;
      return {
        row,
        ...scored,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime();
    })
    .map(({ row, matchedInterest }) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      category: row.category,
      matchedInterest,
      displayImageUrl: pickProductDisplayImage({
        mediaUrls: row.media_urls,
        vendorLogoUrl: row.vendor?.logo_url,
      }),
      vendor: row.vendor
        ? {
            business_name: row.vendor.business_name,
            category: row.vendor.category,
            sell_city: row.vendor.sell_city,
            sell_state: row.vendor.sell_state,
            logo_url: row.vendor.logo_url,
          }
        : null,
    }));
}

export async function fetchSuggestedProducts(
  interests: string[],
  context: SuggestedProductsContext = {},
  limit = 8,
): Promise<SuggestedProduct[]> {
  if (interests.length === 0) return [];

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, price, media_urls, category, created_at, vendor:vendors(business_name, category, sell_city, sell_state, logo_url, approval_status)',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  const rows = ((data ?? []) as unknown[]).map((row) => {
    const raw = row as ProductRow & {
      vendor?: ProductRow['vendor'] | NonNullable<ProductRow['vendor']>[];
    };
    return { ...raw, vendor: firstRelation(raw.vendor) };
  });
  return rankSuggestedProducts(rows, interests, context).slice(0, limit);
}
