/** Product variants JSON stored on `products.variants` (Phase 50). */

export interface VariantAttribute {
  name: string;
  values: string[];
}

export interface VariantCombination {
  id: string;
  /** e.g. { Size: "M", Color: "Black" } */
  options: Record<string, string>;
  price_cents: number;
  stock: number;
  sku?: string | null;
}

export interface ProductVariantsPayload {
  attributes: VariantAttribute[];
  combinations: VariantCombination[];
}

export function emptyVariantsPayload(): ProductVariantsPayload {
  return { attributes: [], combinations: [] };
}

export function parseVariants(raw: unknown): ProductVariantsPayload {
  if (!raw || typeof raw !== 'object') return emptyVariantsPayload();
  const obj = raw as Record<string, unknown>;
  const attributes = Array.isArray(obj.attributes)
    ? (obj.attributes as VariantAttribute[]).filter(
        (a) => a && typeof a.name === 'string' && Array.isArray(a.values),
      )
    : [];
  const combinations = Array.isArray(obj.combinations)
    ? (obj.combinations as VariantCombination[]).filter(
        (c) => c && typeof c.id === 'string' && c.options && typeof c.price_cents === 'number',
      )
    : [];
  return { attributes, combinations };
}

export function combinationLabel(combo: VariantCombination): string {
  return Object.entries(combo.options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

function cartesian(attrs: VariantAttribute[]): Record<string, string>[] {
  const usable = attrs.filter((a) => a.name.trim() && a.values.some((v) => v.trim()));
  if (usable.length === 0) return [];

  let rows: Record<string, string>[] = [{}];
  for (const attr of usable) {
    const name = attr.name.trim();
    const values = attr.values.map((v) => v.trim()).filter(Boolean);
    const next: Record<string, string>[] = [];
    for (const row of rows) {
      for (const value of values) {
        next.push({ ...row, [name]: value });
      }
    }
    rows = next;
  }
  return rows;
}

function comboKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('|');
}

/** Rebuild combinations from attributes, preserving price/stock when options match. */
export function regenerateCombinations(
  attributes: VariantAttribute[],
  previous: VariantCombination[],
  defaultPriceCents: number,
): VariantCombination[] {
  const prevByKey = new Map(previous.map((c) => [comboKey(c.options), c]));
  return cartesian(attributes).map((options) => {
    const key = comboKey(options);
    const prior = prevByKey.get(key);
    return {
      id: prior?.id ?? crypto.randomUUID(),
      options,
      price_cents: prior?.price_cents ?? defaultPriceCents,
      stock: prior?.stock ?? 0,
      sku: prior?.sku ?? null,
    };
  });
}
