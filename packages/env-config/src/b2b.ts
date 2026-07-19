import { z } from 'zod';

export const vendorBusinessConnectionStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
]);

export type VendorBusinessConnectionStatus = z.infer<
  typeof vendorBusinessConnectionStatusSchema
>;

export const vendorConnectionRequestSchema = z
  .object({
    receiverVendorId: z
      .string({
        required_error: 'B2B_VALIDATION_ERROR: RECEIVER_VENDOR_ID REQUIRED',
        invalid_type_error: 'B2B_VALIDATION_ERROR: RECEIVER_VENDOR_ID INVALID',
      })
      .uuid('B2B_VALIDATION_ERROR: RECEIVER_VENDOR_ID MUST BE UUID'),
  })
  .strict();

export type VendorConnectionRequestInput = z.infer<
  typeof vendorConnectionRequestSchema
>;

export type VendorConnectionRequestParseResult =
  | { OK: true; DATA: VendorConnectionRequestInput }
  | { OK: false; ERROR: string };

export function parseVendorConnectionRequest(
  input: unknown,
): VendorConnectionRequestParseResult {
  const parsed = vendorConnectionRequestSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'B2B_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

const pricingTierSchema = z
  .object({
    minQty: z
      .number({
        invalid_type_error: 'WHOLESALE_VALIDATION_ERROR: TIER_MIN_QTY INVALID',
      })
      .int('WHOLESALE_VALIDATION_ERROR: TIER_MIN_QTY MUST BE INTEGER')
      .positive('WHOLESALE_VALIDATION_ERROR: TIER_MIN_QTY MUST BE POSITIVE'),
    unitPriceCents: z
      .number({
        invalid_type_error:
          'WHOLESALE_VALIDATION_ERROR: TIER_UNIT_PRICE_CENTS INVALID',
      })
      .int('WHOLESALE_VALIDATION_ERROR: TIER_UNIT_PRICE_CENTS MUST BE INTEGER')
      .nonnegative(
        'WHOLESALE_VALIDATION_ERROR: TIER_UNIT_PRICE_CENTS MUST BE NONNEGATIVE',
      ),
  })
  .strict();

export const wholesaleProductCreateSchema = z
  .object({
    name: z
      .string({
        required_error: 'WHOLESALE_VALIDATION_ERROR: NAME REQUIRED',
      })
      .trim()
      .min(1, 'WHOLESALE_VALIDATION_ERROR: NAME REQUIRED')
      .max(200, 'WHOLESALE_VALIDATION_ERROR: NAME TOO LONG'),
    description: z
      .string()
      .trim()
      .max(4000, 'WHOLESALE_VALIDATION_ERROR: DESCRIPTION TOO LONG')
      .optional()
      .nullable(),
    packagingUnit: z
      .string({
        required_error: 'WHOLESALE_VALIDATION_ERROR: PACKAGING_UNIT REQUIRED',
      })
      .trim()
      .min(1, 'WHOLESALE_VALIDATION_ERROR: PACKAGING_UNIT REQUIRED')
      .max(64, 'WHOLESALE_VALIDATION_ERROR: PACKAGING_UNIT TOO LONG')
      .transform((value) => value.toUpperCase()),
    weightLbs: z.coerce
      .number({
        required_error: 'WHOLESALE_VALIDATION_ERROR: WEIGHT_LBS REQUIRED',
        invalid_type_error: 'WHOLESALE_VALIDATION_ERROR: WEIGHT_LBS INVALID',
      })
      .positive('WHOLESALE_VALIDATION_ERROR: WEIGHT_LBS MUST BE POSITIVE')
      .max(1_000_000, 'WHOLESALE_VALIDATION_ERROR: WEIGHT_LBS TOO LARGE')
      .refine(
        (value) => Number.isFinite(value),
        'WHOLESALE_VALIDATION_ERROR: WEIGHT_LBS MUST BE FINITE',
      ),
    moq: z.coerce
      .number({
        required_error: 'WHOLESALE_VALIDATION_ERROR: MOQ REQUIRED',
        invalid_type_error: 'WHOLESALE_VALIDATION_ERROR: MOQ INVALID',
      })
      .int('WHOLESALE_VALIDATION_ERROR: MOQ MUST BE INTEGER')
      .positive('WHOLESALE_VALIDATION_ERROR: MOQ MUST BE POSITIVE')
      .max(1_000_000, 'WHOLESALE_VALIDATION_ERROR: MOQ TOO LARGE'),
    unitPriceCents: z.coerce
      .number({
        required_error: 'WHOLESALE_VALIDATION_ERROR: UNIT_PRICE_CENTS REQUIRED',
        invalid_type_error:
          'WHOLESALE_VALIDATION_ERROR: UNIT_PRICE_CENTS INVALID',
      })
      .int('WHOLESALE_VALIDATION_ERROR: UNIT_PRICE_CENTS MUST BE INTEGER')
      .nonnegative(
        'WHOLESALE_VALIDATION_ERROR: UNIT_PRICE_CENTS MUST BE NONNEGATIVE',
      ),
    pricingTiers: z
      .array(pricingTierSchema)
      .max(20, 'WHOLESALE_VALIDATION_ERROR: PRICING_TIERS MAX 20')
      .default([]),
    freightNotes: z
      .string()
      .trim()
      .max(2000, 'WHOLESALE_VALIDATION_ERROR: FREIGHT_NOTES TOO LONG')
      .optional()
      .nullable(),
    pickupNotes: z
      .string()
      .trim()
      .max(2000, 'WHOLESALE_VALIDATION_ERROR: PICKUP_NOTES TOO LONG')
      .optional()
      .nullable(),
  })
  .strict();

export type WholesaleProductCreateInput = z.infer<
  typeof wholesaleProductCreateSchema
>;

export type WholesaleProductCreateParseResult =
  | { OK: true; DATA: WholesaleProductCreateInput }
  | { OK: false; ERROR: string };

export function parseWholesaleProductCreate(
  input: unknown,
): WholesaleProductCreateParseResult {
  const parsed = wholesaleProductCreateSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'WHOLESALE_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}
