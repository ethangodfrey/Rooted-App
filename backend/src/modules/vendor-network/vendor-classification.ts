/**
 * Phase 83a — vendor classification helpers.
 *
 * API / logs use uppercase tokens (HOME, PRIVATE_CHEF, MICRO_BRAND).
 * Postgres `vendors.vendor_type` stores snake_case values from phase83a SQL.
 */

export type VendorClassification =
  | 'HOME'
  | 'PRIVATE_CHEF'
  | 'MICRO_BRAND'
  | 'FARMERS_MARKET'
  | 'FOOD_BUSINESS'
  | 'CATERER'
  | 'MEAL_PREP';

export type VendorTypeDb =
  | 'home_kitchen'
  | 'private_chef'
  | 'micro_brand'
  | 'farmers_market'
  | 'food_business'
  | 'caterer'
  | 'meal_prep';

const CLASSIFICATION_TO_DB: Record<VendorClassification, VendorTypeDb> = {
  HOME: 'home_kitchen',
  PRIVATE_CHEF: 'private_chef',
  MICRO_BRAND: 'micro_brand',
  FARMERS_MARKET: 'farmers_market',
  FOOD_BUSINESS: 'food_business',
  CATERER: 'caterer',
  MEAL_PREP: 'meal_prep',
};

const DB_TO_CLASSIFICATION: Record<VendorTypeDb, VendorClassification> = {
  home_kitchen: 'HOME',
  private_chef: 'PRIVATE_CHEF',
  micro_brand: 'MICRO_BRAND',
  farmers_market: 'FARMERS_MARKET',
  food_business: 'FOOD_BUSINESS',
  caterer: 'CATERER',
  meal_prep: 'MEAL_PREP',
};

export const PHASE83A_CLASSIFICATIONS: readonly VendorClassification[] = [
  'HOME',
  'PRIVATE_CHEF',
  'MICRO_BRAND',
] as const;

export function isVendorClassification(
  value: string | null | undefined,
): value is VendorClassification {
  return (
    value === 'HOME' ||
    value === 'PRIVATE_CHEF' ||
    value === 'MICRO_BRAND' ||
    value === 'FARMERS_MARKET' ||
    value === 'FOOD_BUSINESS' ||
    value === 'CATERER' ||
    value === 'MEAL_PREP'
  );
}

export function classificationToDb(
  classification: VendorClassification,
): VendorTypeDb {
  return CLASSIFICATION_TO_DB[classification];
}

export function dbToClassification(
  vendorType: string | null | undefined,
): VendorClassification | null {
  if (!vendorType) return null;
  if (isVendorClassification(vendorType)) return vendorType;
  return DB_TO_CLASSIFICATION[vendorType as VendorTypeDb] ?? null;
}

export function isPhase83aClassification(
  value: VendorClassification | null | undefined,
): boolean {
  return (
    value === 'HOME' ||
    value === 'PRIVATE_CHEF' ||
    value === 'MICRO_BRAND'
  );
}
