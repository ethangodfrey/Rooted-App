import type { Product, StateFoodRegulation, Vendor } from '@/src/types/database';

const ALLERGENS = new Set([
  'peanut',
  'tree_nut',
  'dairy',
  'egg',
  'soy',
  'wheat',
  'gluten',
  'fish',
  'shellfish',
  'sesame',
]);

export interface ProductLabel {
  product_name: string;
  business_name: string;
  business_address: string;
  ingredients: string[];
  allergens: string[];
  net_weight?: string;
  production_date?: string;
  disclaimer: string;
}

export function extractAllergensFromTags(tags: string[] | null | undefined): string[] {
  if (!tags?.length) return [];
  return tags.filter((tag) => ALLERGENS.has(tag.toLowerCase().replace(/-/g, '_')));
}

/** Auto-generate a cottage-food compliant label from product + vendor + state rules. */
export function generateCompliantLabel(
  product: Pick<Product, 'name' | 'ingredients' | 'dietary_tags' | 'serving_size'>,
  vendor: Pick<Vendor, 'business_name' | 'sell_city' | 'sell_state'>,
  stateRegs: Pick<StateFoodRegulation, 'required_disclaimer'>,
): ProductLabel {
  const city = vendor.sell_city ?? '';
  const state = vendor.sell_state ?? '';

  return {
    product_name: product.name,
    business_name: vendor.business_name ?? 'Local food business',
    business_address: [city, state].filter(Boolean).join(', '),
    ingredients: product.ingredients
      ? product.ingredients.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    allergens: extractAllergensFromTags(product.dietary_tags),
    net_weight: product.serving_size ?? undefined,
    disclaimer:
      stateRegs.required_disclaimer ??
      'Made in a home kitchen that is not inspected by the state health department.',
  };
}

export function formatProductLabel(label: ProductLabel): string {
  const lines = [
    label.product_name,
    `Prepared by: ${label.business_name}`,
    label.business_address ? `Location: ${label.business_address}` : null,
    label.ingredients.length ? `Ingredients: ${label.ingredients.join(', ')}` : null,
    label.allergens.length ? `Allergens: ${label.allergens.join(', ')}` : null,
    label.net_weight ? `Net weight: ${label.net_weight}` : null,
    label.production_date ? `Produced: ${label.production_date}` : null,
    '',
    label.disclaimer,
  ];
  return lines.filter(Boolean).join('\n');
}

export function complianceChecklistForState(
  regs: StateFoodRegulation | null,
): { label: string; required: boolean; met?: boolean }[] {
  if (!regs) {
    return [{ label: 'Select your state to see cottage food requirements', required: true }];
  }

  return [
    { label: 'Cottage food sales allowed in your state', required: true, met: regs.cottage_food_allowed },
    {
      label: regs.requires_food_handler_cert
        ? 'Food handler certification on file'
        : 'Food handler certification (recommended)',
      required: regs.requires_food_handler_cert,
    },
    {
      label: regs.requires_permit ? 'Cottage food permit uploaded' : 'Permit (if required by state)',
      required: regs.requires_permit,
    },
    { label: 'Product labels include required fields', required: true },
    { label: 'No prohibited products listed (meat, dairy, etc.)', required: true },
  ];
}
