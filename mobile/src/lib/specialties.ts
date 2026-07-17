/** Permanent vendor specialty tokens — uppercase, no emojis. */
export const VENDOR_SPECIALTIES = [
  'HOME_BAKER',
  'PRIVATE_CHEF',
  'PREPARED_MEALS',
  'ARTISAN_CRAFTS',
  'APPAREL_BRAND',
  'HOT_FOOD_CATERING',
] as const;

/** Permanent farmer specialty tokens — uppercase, no emojis. */
export const FARMER_SPECIALTIES = [
  'PRODUCE_VEG',
  'ORCHARD_FRUIT',
  'LIVESTOCK_MEAT',
  'POULTRY_EGGS',
  'DAIRY',
  'APIARY_HONEY',
  'HYDRO_MICROGREENS',
  'FLORICULTURE',
] as const;

export type VendorSpecialty = (typeof VENDOR_SPECIALTIES)[number];
export type FarmerSpecialty = (typeof FARMER_SPECIALTIES)[number];
export type SpecialtyTag = VendorSpecialty | FarmerSpecialty;

/** Human-readable uppercase labels for specialty pills / filters. */
export const SPECIALTY_LABELS: Record<SpecialtyTag, string> = {
  HOME_BAKER: 'HOME BAKER',
  PRIVATE_CHEF: 'PRIVATE CHEF',
  PREPARED_MEALS: 'PREPARED MEALS',
  ARTISAN_CRAFTS: 'ARTISAN CRAFTS',
  APPAREL_BRAND: 'APPAREL BRAND',
  HOT_FOOD_CATERING: 'HOT FOOD CATERING',
  PRODUCE_VEG: 'PRODUCE & VEGETABLES',
  ORCHARD_FRUIT: 'ORCHARD FRUIT',
  LIVESTOCK_MEAT: 'LIVESTOCK & MEAT',
  POULTRY_EGGS: 'POULTRY & EGGS',
  DAIRY: 'DAIRY',
  APIARY_HONEY: 'APIARY & HONEY',
  HYDRO_MICROGREENS: 'HYDRO & MICROGREENS',
  FLORICULTURE: 'FLORICULTURE',
};

/** Short directory filter copy, e.g. "Find Livestock Farmers". */
export const SPECIALTY_FILTER_LABELS: Record<SpecialtyTag, string> = {
  HOME_BAKER: 'Find Home Bakers',
  PRIVATE_CHEF: 'Find Private Chefs',
  PREPARED_MEALS: 'Find Prepared Meals',
  ARTISAN_CRAFTS: 'Find Artisan Crafts',
  APPAREL_BRAND: 'Find Apparel Brands',
  HOT_FOOD_CATERING: 'Find Hot Food Catering',
  PRODUCE_VEG: 'Find Produce Farmers',
  ORCHARD_FRUIT: 'Find Orchard Farmers',
  LIVESTOCK_MEAT: 'Find Livestock Farmers',
  POULTRY_EGGS: 'Find Poultry Farmers',
  DAIRY: 'Find Dairy Farmers',
  APIARY_HONEY: 'Find Apiary Farmers',
  HYDRO_MICROGREENS: 'Find Microgreen Growers',
  FLORICULTURE: 'Find Floriculture Farms',
};

export function specialtyLabel(tag: string): string {
  const key = tag.trim().toUpperCase() as SpecialtyTag;
  return SPECIALTY_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function specialtiesForRole(
  role: 'vendor' | 'farmer' | string | null | undefined,
): readonly SpecialtyTag[] {
  if (role === 'farmer') return FARMER_SPECIALTIES;
  if (role === 'vendor') return VENDOR_SPECIALTIES;
  return [];
}

export function normalizeSpecialtySelection(
  role: 'vendor' | 'farmer',
  selected: string[],
): SpecialtyTag[] {
  const allow = new Set<string>(specialtiesForRole(role));
  return selected
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is SpecialtyTag => allow.has(s));
}

export function isVendorSpecialty(tag: string): tag is VendorSpecialty {
  return (VENDOR_SPECIALTIES as readonly string[]).includes(tag);
}

export function isFarmerSpecialty(tag: string): tag is FarmerSpecialty {
  return (FARMER_SPECIALTIES as readonly string[]).includes(tag);
}
