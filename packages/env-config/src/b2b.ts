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

/** Phase 11 peer engine — PENDING | ACCEPTED | BLOCKED */
export const vendorPeerConnectionStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'BLOCKED',
]);

export type VendorPeerConnectionStatus = z.infer<
  typeof vendorPeerConnectionStatusSchema
>;

export const vendorPeerRequestCreateSchema = z
  .object({
    recipient_id: z
      .string({
        required_error: 'PEER_VALIDATION_ERROR: RECIPIENT_ID REQUIRED',
        invalid_type_error: 'PEER_VALIDATION_ERROR: RECIPIENT_ID INVALID',
      })
      .uuid('PEER_VALIDATION_ERROR: RECIPIENT_ID MUST BE UUID')
      .optional(),
    recipientId: z
      .string({
        invalid_type_error: 'PEER_VALIDATION_ERROR: RECIPIENT_ID INVALID',
      })
      .uuid('PEER_VALIDATION_ERROR: RECIPIENT_ID MUST BE UUID')
      .optional(),
  })
  .strict()
  .transform((value, ctx) => {
    const recipientId = value.recipient_id ?? value.recipientId;
    if (!recipientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PEER_VALIDATION_ERROR: RECIPIENT_ID REQUIRED',
      });
      return z.NEVER;
    }
    return { recipientId };
  });

export type VendorPeerRequestCreateInput = z.infer<
  typeof vendorPeerRequestCreateSchema
>;

export type VendorPeerRequestCreateParseResult =
  | { OK: true; DATA: VendorPeerRequestCreateInput }
  | { OK: false; ERROR: string };

export function parseVendorPeerRequestCreate(
  input: unknown,
): VendorPeerRequestCreateParseResult {
  const parsed = vendorPeerRequestCreateSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'PEER_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

/** PATCH /api/vendors/requests/:requestId — accept or block. */
export const vendorPeerRequestUpdateSchema = z
  .object({
    status: z.enum(['ACCEPTED', 'BLOCKED'], {
      required_error: 'PEER_VALIDATION_ERROR: STATUS REQUIRED',
      invalid_type_error: 'PEER_VALIDATION_ERROR: STATUS MUST BE ACCEPTED OR BLOCKED',
    }),
  })
  .strict();

export type VendorPeerRequestUpdateInput = z.infer<
  typeof vendorPeerRequestUpdateSchema
>;

export type VendorPeerRequestUpdateParseResult =
  | { OK: true; DATA: VendorPeerRequestUpdateInput }
  | { OK: false; ERROR: string };

export function parseVendorPeerRequestUpdate(
  input: unknown,
): VendorPeerRequestUpdateParseResult {
  const parsed = vendorPeerRequestUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'PEER_VALIDATION_ERROR' };
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
    availableQuantity: z.coerce
      .number({
        invalid_type_error:
          'WHOLESALE_VALIDATION_ERROR: AVAILABLE_QUANTITY INVALID',
      })
      .int('WHOLESALE_VALIDATION_ERROR: AVAILABLE_QUANTITY MUST BE INTEGER')
      .nonnegative(
        'WHOLESALE_VALIDATION_ERROR: AVAILABLE_QUANTITY MUST BE NONNEGATIVE',
      )
      .max(1_000_000_000, 'WHOLESALE_VALIDATION_ERROR: AVAILABLE_QUANTITY TOO LARGE')
      .optional(),
    isRetailEnabled: z.boolean().optional().default(false),
    retailPrice: z.coerce
      .number({
        invalid_type_error: 'WHOLESALE_VALIDATION_ERROR: RETAIL_PRICE INVALID',
      })
      .nonnegative('WHOLESALE_VALIDATION_ERROR: RETAIL_PRICE MUST BE NONNEGATIVE')
      .max(1_000_000, 'WHOLESALE_VALIDATION_ERROR: RETAIL_PRICE TOO LARGE')
      .optional()
      .nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.isRetailEnabled && (value.retailPrice == null || value.retailPrice <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WHOLESALE_VALIDATION_ERROR: RETAIL_PRICE REQUIRED WHEN RETAIL ENABLED',
        path: ['retailPrice'],
      });
    }
  });

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

const wholesaleOrderDraftItemSchema = z
  .object({
    product_sku_id: z
      .string({
        required_error: 'WHOLESALE_ORDER_VALIDATION_ERROR: PRODUCT_SKU_ID REQUIRED',
        invalid_type_error:
          'WHOLESALE_ORDER_VALIDATION_ERROR: PRODUCT_SKU_ID INVALID',
      })
      .uuid('WHOLESALE_ORDER_VALIDATION_ERROR: PRODUCT_SKU_ID MUST BE UUID'),
    quantity: z.coerce
      .number({
        required_error: 'WHOLESALE_ORDER_VALIDATION_ERROR: QUANTITY REQUIRED',
        invalid_type_error: 'WHOLESALE_ORDER_VALIDATION_ERROR: QUANTITY INVALID',
      })
      .int('WHOLESALE_ORDER_VALIDATION_ERROR: QUANTITY MUST BE INTEGER')
      .positive('WHOLESALE_ORDER_VALIDATION_ERROR: QUANTITY MUST BE POSITIVE')
      .max(1_000_000, 'WHOLESALE_ORDER_VALIDATION_ERROR: QUANTITY TOO LARGE'),
    negotiated_tier_unit_price: z.coerce
      .number({
        required_error:
          'WHOLESALE_ORDER_VALIDATION_ERROR: NEGOTIATED_TIER_UNIT_PRICE REQUIRED',
        invalid_type_error:
          'WHOLESALE_ORDER_VALIDATION_ERROR: NEGOTIATED_TIER_UNIT_PRICE INVALID',
      })
      .int(
        'WHOLESALE_ORDER_VALIDATION_ERROR: NEGOTIATED_TIER_UNIT_PRICE MUST BE INTEGER',
      )
      .nonnegative(
        'WHOLESALE_ORDER_VALIDATION_ERROR: NEGOTIATED_TIER_UNIT_PRICE MUST BE NONNEGATIVE',
      ),
  })
  .strict();

export const wholesaleOrderDraftCreateSchema = z
  .object({
    buyer_vendor_id: z
      .string({
        required_error: 'WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_VENDOR_ID REQUIRED',
        invalid_type_error:
          'WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_VENDOR_ID INVALID',
      })
      .uuid('WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_VENDOR_ID MUST BE UUID'),
    seller_vendor_id: z
      .string({
        required_error:
          'WHOLESALE_ORDER_VALIDATION_ERROR: SELLER_VENDOR_ID REQUIRED',
        invalid_type_error:
          'WHOLESALE_ORDER_VALIDATION_ERROR: SELLER_VENDOR_ID INVALID',
      })
      .uuid('WHOLESALE_ORDER_VALIDATION_ERROR: SELLER_VENDOR_ID MUST BE UUID'),
    items: z
      .array(wholesaleOrderDraftItemSchema)
      .min(1, 'WHOLESALE_ORDER_VALIDATION_ERROR: ITEMS REQUIRED')
      .max(100, 'WHOLESALE_ORDER_VALIDATION_ERROR: ITEMS MAX 100'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.buyer_vendor_id === value.seller_vendor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_SELLER_MUST_DIFFER',
        path: ['seller_vendor_id'],
      });
    }
  });

export type WholesaleOrderDraftCreateInput = z.infer<
  typeof wholesaleOrderDraftCreateSchema
>;

export type WholesaleOrderDraftCreateParseResult =
  | { OK: true; DATA: WholesaleOrderDraftCreateInput }
  | { OK: false; ERROR: string };

export function parseWholesaleOrderDraftCreate(
  input: unknown,
): WholesaleOrderDraftCreateParseResult {
  const parsed = wholesaleOrderDraftCreateSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'WHOLESALE_ORDER_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

export const wholesaleOrderFulfillmentSchema = z
  .object({
    order_id: z
      .string({
        required_error: 'FULFILLMENT_VALIDATION_ERROR: ORDER_ID REQUIRED',
        invalid_type_error: 'FULFILLMENT_VALIDATION_ERROR: ORDER_ID INVALID',
      })
      .uuid('FULFILLMENT_VALIDATION_ERROR: ORDER_ID MUST BE UUID'),
    carrier_name: z
      .string({
        required_error: 'FULFILLMENT_VALIDATION_ERROR: CARRIER_NAME REQUIRED',
        invalid_type_error: 'FULFILLMENT_VALIDATION_ERROR: CARRIER_NAME INVALID',
      })
      .trim()
      .min(1, 'FULFILLMENT_VALIDATION_ERROR: CARRIER_NAME REQUIRED')
      .max(120, 'FULFILLMENT_VALIDATION_ERROR: CARRIER_NAME TOO LONG'),
    tracking_number: z
      .string({
        required_error: 'FULFILLMENT_VALIDATION_ERROR: TRACKING_NUMBER REQUIRED',
        invalid_type_error:
          'FULFILLMENT_VALIDATION_ERROR: TRACKING_NUMBER INVALID',
      })
      .trim()
      .min(1, 'FULFILLMENT_VALIDATION_ERROR: TRACKING_NUMBER REQUIRED')
      .max(120, 'FULFILLMENT_VALIDATION_ERROR: TRACKING_NUMBER TOO LONG'),
    estimated_delivery_at: z
      .string({
        required_error:
          'FULFILLMENT_VALIDATION_ERROR: ESTIMATED_DELIVERY_AT REQUIRED',
        invalid_type_error:
          'FULFILLMENT_VALIDATION_ERROR: ESTIMATED_DELIVERY_AT INVALID',
      })
      .trim()
      .min(1, 'FULFILLMENT_VALIDATION_ERROR: ESTIMATED_DELIVERY_AT REQUIRED')
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message:
          'FULFILLMENT_VALIDATION_ERROR: ESTIMATED_DELIVERY_AT MUST BE ISO8601',
      }),
  })
  .strict();

export type WholesaleOrderFulfillmentInput = z.infer<
  typeof wholesaleOrderFulfillmentSchema
>;

export type WholesaleOrderFulfillmentParseResult =
  | { OK: true; DATA: WholesaleOrderFulfillmentInput }
  | { OK: false; ERROR: string };

export function parseWholesaleOrderFulfillment(
  input: unknown,
): WholesaleOrderFulfillmentParseResult {
  const parsed = wholesaleOrderFulfillmentSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'FULFILLMENT_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

export const wholesaleOrderSettlementSchema = z
  .object({
    order_id: z
      .string({
        required_error: 'SETTLEMENT_VALIDATION_ERROR: ORDER_ID REQUIRED',
        invalid_type_error: 'SETTLEMENT_VALIDATION_ERROR: ORDER_ID INVALID',
      })
      .uuid('SETTLEMENT_VALIDATION_ERROR: ORDER_ID MUST BE UUID'),
    delivered_at: z
      .string({
        required_error: 'SETTLEMENT_VALIDATION_ERROR: DELIVERED_AT REQUIRED',
        invalid_type_error: 'SETTLEMENT_VALIDATION_ERROR: DELIVERED_AT INVALID',
      })
      .trim()
      .min(1, 'SETTLEMENT_VALIDATION_ERROR: DELIVERED_AT REQUIRED')
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'SETTLEMENT_VALIDATION_ERROR: DELIVERED_AT MUST BE ISO8601',
      }),
  })
  .strict();

export type WholesaleOrderSettlementInput = z.infer<
  typeof wholesaleOrderSettlementSchema
>;

export type WholesaleOrderSettlementParseResult =
  | { OK: true; DATA: WholesaleOrderSettlementInput }
  | { OK: false; ERROR: string };

export function parseWholesaleOrderSettlement(
  input: unknown,
): WholesaleOrderSettlementParseResult {
  const parsed = wholesaleOrderSettlementSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'SETTLEMENT_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

export const wholesaleInvoiceReconcileSchema = z
  .object({
    invoice_id: z
      .string({
        required_error: 'INVOICE_RECONCILE_VALIDATION_ERROR: INVOICE_ID REQUIRED',
        invalid_type_error:
          'INVOICE_RECONCILE_VALIDATION_ERROR: INVOICE_ID INVALID',
      })
      .uuid('INVOICE_RECONCILE_VALIDATION_ERROR: INVOICE_ID MUST BE UUID'),
    paid_at: z
      .string({
        invalid_type_error: 'INVOICE_RECONCILE_VALIDATION_ERROR: PAID_AT INVALID',
      })
      .trim()
      .refine((value) => value.length === 0 || !Number.isNaN(Date.parse(value)), {
        message: 'INVOICE_RECONCILE_VALIDATION_ERROR: PAID_AT MUST BE ISO8601',
      })
      .optional(),
  })
  .strict();

export type WholesaleInvoiceReconcileInput = z.infer<
  typeof wholesaleInvoiceReconcileSchema
>;

export type WholesaleInvoiceReconcileParseResult =
  | { OK: true; DATA: WholesaleInvoiceReconcileInput }
  | { OK: false; ERROR: string };

export function parseWholesaleInvoiceReconcile(
  input: unknown,
): WholesaleInvoiceReconcileParseResult {
  const parsed = wholesaleInvoiceReconcileSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'INVOICE_RECONCILE_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}
