export const CATEGORY_VISUALS: Record<string, { emoji: string; label: string }> = {
  'Food & Drink': { emoji: '🍽️', label: 'Food & Drink' },
  'Baked Goods': { emoji: '🥐', label: 'Baked Goods' },
  'Art & Prints': { emoji: '🎨', label: 'Art & Prints' },
  Jewelry: { emoji: '💎', label: 'Jewelry' },
  Apparel: { emoji: '👕', label: 'Apparel' },
  'Home & Decor': { emoji: '🏠', label: 'Home & Decor' },
  Plants: { emoji: '🌿', label: 'Plants' },
  'Candles & Soap': { emoji: '🕯️', label: 'Candles & Soap' },
  'Vintage & Thrift': { emoji: '🏺', label: 'Vintage & Thrift' },
  'Handmade Crafts': { emoji: '✂️', label: 'Handmade Crafts' },
  Wellness: { emoji: '🧘', label: 'Wellness' },
  'Pet Goods': { emoji: '🐾', label: 'Pet Goods' },
};

export function categoryVisual(category: string | null | undefined) {
  if (category && CATEGORY_VISUALS[category]) return CATEGORY_VISUALS[category];
  return { emoji: '🛒', label: category ?? 'Local find' };
}
