import { evaluateWholesalePricing } from './pricing';
import type { WholesaleOrderDraftPayload, WholesaleProductRow } from './types';

export type WholesaleOrderLineInput = {
  product: WholesaleProductRow;
  quantity: number;
};

export type AssembledWholesaleOrder = {
  payload: WholesaleOrderDraftPayload;
  subtotalCents: number;
  lineCount: number;
  valid: boolean;
  reason: string | null;
};

/** Assemble snake_case checkout payload from MOQ-validated catalog lines. */
export function assembleWholesaleOrderPayload(input: {
  buyerVendorId: string;
  sellerVendorId: string;
  lines: WholesaleOrderLineInput[];
}): AssembledWholesaleOrder {
  const buyer = input.buyerVendorId.trim();
  const seller = input.sellerVendorId.trim();

  if (!buyer || !seller) {
    return {
      payload: { buyer_vendor_id: buyer, seller_vendor_id: seller, items: [] },
      subtotalCents: 0,
      lineCount: 0,
      valid: false,
      reason: 'WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_SELLER_REQUIRED',
    };
  }

  if (buyer === seller) {
    return {
      payload: { buyer_vendor_id: buyer, seller_vendor_id: seller, items: [] },
      subtotalCents: 0,
      lineCount: 0,
      valid: false,
      reason: 'WHOLESALE_ORDER_VALIDATION_ERROR: BUYER_SELLER_MUST_DIFFER',
    };
  }

  const items: WholesaleOrderDraftPayload['items'] = [];
  let subtotalCents = 0;

  for (const line of input.lines) {
    const moq = Number(line.product.MOQ) || 1;
    const qty = Number.isFinite(line.quantity)
      ? Math.max(0, Math.floor(line.quantity))
      : 0;
    if (qty <= 0) continue;

    const priced = evaluateWholesalePricing({
      quantity: qty,
      moq,
      baseUnitPriceCents: line.product.UNIT_PRICE_CENTS,
      tiersRaw: line.product.PRICING_TIERS,
    });

    if (priced.moqGuardActive || !priced.moqSatisfied) {
      return {
        payload: { buyer_vendor_id: buyer, seller_vendor_id: seller, items: [] },
        subtotalCents: 0,
        lineCount: 0,
        valid: false,
        reason: `MOQ_GUARD_ACTIVE SKU=${line.product.ID}`,
      };
    }

    items.push({
      product_sku_id: line.product.ID,
      quantity: qty,
      negotiated_tier_unit_price: priced.unitPriceCents,
    });
    subtotalCents += priced.lineTotalCents;
  }

  if (items.length === 0) {
    return {
      payload: { buyer_vendor_id: buyer, seller_vendor_id: seller, items: [] },
      subtotalCents: 0,
      lineCount: 0,
      valid: false,
      reason: 'WHOLESALE_ORDER_VALIDATION_ERROR: ITEMS REQUIRED',
    };
  }

  // eslint-disable-next-line no-console
  console.log(
    `WHOLESALE_PAYLOAD_VALID BUYER=${buyer} SELLER=${seller} LINES=${items.length} SUBTOTAL_CENTS=${subtotalCents}`,
  );

  return {
    payload: {
      buyer_vendor_id: buyer,
      seller_vendor_id: seller,
      items,
    },
    subtotalCents,
    lineCount: items.length,
    valid: true,
    reason: null,
  };
}
