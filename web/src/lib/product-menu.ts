/** Preferred tab order for vendor product menus (shopper-facing). */
export const PRODUCT_MENU_TAB_ORDER = [
  'All',
  'Fresh Produce',
  'Baked Goods',
  'Prepared Foods',
  'Food & Drink',
  'Plants',
  'Handmade Crafts',
  'Other',
] as const;

export type ProductMenuTab = (typeof PRODUCT_MENU_TAB_ORDER)[number];

export interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  reserve_enabled: boolean;
  media_urls: string[] | null;
  product_event_availability?: { available_quantity_presale: number }[];
}

function normalizeMenuCategory(category: string | null | undefined): string {
  if (!category?.trim()) return 'Other';
  const value = category.trim();
  const lower = value.toLowerCase();
  if (lower.includes('produce') || lower.includes('vegetable') || lower.includes('fruit')) {
    return 'Fresh Produce';
  }
  if (lower.includes('baked') || lower.includes('bread') || lower.includes('pastry')) {
    return 'Baked Goods';
  }
  if (lower.includes('prepared') || lower.includes('meal') || lower.includes('ready')) {
    return 'Prepared Foods';
  }
  return value;
}

export function productMenuTabs(products: MenuProduct[]): ProductMenuTab[] {
  const buckets = new Set<string>();
  for (const product of products) {
    buckets.add(normalizeMenuCategory(product.category));
  }

  const ordered = PRODUCT_MENU_TAB_ORDER.filter(
    (tab) => tab === 'All' || buckets.has(tab),
  );

  for (const bucket of buckets) {
    if (!ordered.includes(bucket as ProductMenuTab)) {
      ordered.push(bucket as ProductMenuTab);
    }
  }

  return ordered;
}

export function filterProductsByTab(products: MenuProduct[], tab: string): MenuProduct[] {
  if (tab === 'All') return products;
  return products.filter((product) => normalizeMenuCategory(product.category) === tab);
}

export function isProductReservable(product: MenuProduct): boolean {
  return (
    product.reserve_enabled &&
    (product.product_event_availability?.some((row) => row.available_quantity_presale > 0) ?? false)
  );
}
