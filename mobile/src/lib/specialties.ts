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

export function specialtiesForRole(role: 'vendor' | 'farmer' | string | null | undefined): readonly SpecialtyTag[] {
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
