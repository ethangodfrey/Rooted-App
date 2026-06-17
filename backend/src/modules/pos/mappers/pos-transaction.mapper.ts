import type { PosImportedLineItem, PosImportedTransaction, Product } from '@prisma/client';

import { resolvePosLineItemName } from '../utils/pos-line-item.util';

type LineItemWithProduct = PosImportedLineItem & {
  product: Pick<Product, 'id' | 'name'> | null;
};

type TransactionWithLines = PosImportedTransaction & {
  lineItems: LineItemWithProduct[];
};

function mapLineItem(li: LineItemWithProduct) {
  return {
    id: li.id,
    name: resolvePosLineItemName(li.name, li.grossAmount, li.rawPayload),
    quantity: li.quantity,
    grossAmount: li.grossAmount,
    productId: li.productId,
    product: li.product ? { id: li.product.id, name: li.product.name } : null,
    itemType:
      li.rawPayload && typeof li.rawPayload === 'object'
        ? ((li.rawPayload as Record<string, unknown>).item_type as string | undefined)
        : undefined,
  };
}

function lineItemsFromSquareRaw(raw: unknown) {
  if (!raw || typeof raw !== 'object') return [];
  const order = raw as { line_items?: Array<Record<string, unknown>> };
  return (order.line_items ?? []).map((li, index) => {
    const grossAmount = Math.round(
      Number(
        (li.gross_sales_money as { amount?: number } | undefined)?.amount ??
          (li.total_money as { amount?: number } | undefined)?.amount ??
          0,
      ),
    );
    return {
      id: `raw-${index}`,
      name: resolvePosLineItemName(
        typeof li.name === 'string' ? li.name : typeof li.variation_name === 'string' ? li.variation_name : null,
        grossAmount,
        li,
      ),
      quantity: Math.max(1, Math.round(Number(li.quantity ?? 1))),
      grossAmount,
      productId: null,
      product: null,
      itemType: typeof li.item_type === 'string' ? li.item_type : undefined,
    };
  });
}

function fallbackLineItem(txn: PosImportedTransaction) {
  if (txn.netAmount <= 0) return [];
  return [
    {
      id: `fallback-${txn.id}`,
      name: `Card sale · $${(txn.netAmount / 100).toFixed(2)}`,
      quantity: 1,
      grossAmount: txn.netAmount,
      productId: null,
      product: null,
      itemType: undefined,
    },
  ];
}

/** Stable API shape for mobile analytics (camelCase + guaranteed line items). */
export function mapImportedTransactionForApi(txn: TransactionWithLines) {
  let lineItems = txn.lineItems.map(mapLineItem);

  if (lineItems.length === 0) {
    lineItems = lineItemsFromSquareRaw(txn.rawPayload);
  }
  if (lineItems.length === 0) {
    lineItems = fallbackLineItem(txn);
  }

  return {
    id: txn.id,
    soldAt: txn.soldAt.toISOString(),
    currency: txn.currency,
    grossAmount: txn.grossAmount,
    netAmount: txn.netAmount,
    state: txn.state,
    tenderType: txn.tenderType,
    cardBrand: txn.cardBrand,
    lineItems,
  };
}
