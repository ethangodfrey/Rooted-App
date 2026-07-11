import { supabase } from '@/lib/supabase';

export interface ProductAvailability {
  productId: string;
  eventId: string;
  availablePresale: number;
  reservedQuantity: number;
  maxQuantity: number;
  productName: string;
  price: number;
  vendorId: string;
}

export interface InventoryValidationIssue {
  productId: string;
  productName?: string;
  error: string;
  maxQuantity?: number;
}

export interface InventoryValidationResult {
  valid: boolean;
  issues: InventoryValidationIssue[];
}

/** Fetch presale availability for a product at a specific market. */
export async function fetchProductAvailability(
  productId: string,
  marketId: string,
): Promise<ProductAvailability | null> {
  const { data, error } = await supabase
    .from('product_event_availability')
    .select(
      `product_id, event_id, available_quantity_presale, reserved_quantity,
       product:products(id, name, price, vendor_id, status, reserve_enabled)`,
    )
    .eq('product_id', productId)
    .eq('event_id', marketId)
    .maybeSingle();

  if (error || !data) return null;

  const productRaw = data.product as
    | {
        id: string;
        name: string;
        price: number;
        vendor_id: string;
        status: string;
        reserve_enabled: boolean;
      }
    | {
        id: string;
        name: string;
        price: number;
        vendor_id: string;
        status: string;
        reserve_enabled: boolean;
      }[]
    | null;

  const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;

  if (!product || product.status !== 'active' || !product.reserve_enabled) return null;

  const presale = data.available_quantity_presale ?? 0;
  const reserved = data.reserved_quantity ?? 0;
  const maxQuantity = Math.max(presale - reserved, 0);

  return {
    productId,
    eventId: marketId,
    availablePresale: presale,
    reservedQuantity: reserved,
    maxQuantity,
    productName: product.name,
    price: product.price,
    vendorId: product.vendor_id,
  };
}

/** Validate cart line quantities against live presale inventory caps. */
export async function validateCartInventory(
  marketId: string,
  lines: Array<{ productId: string; quantity: number; name?: string }>,
): Promise<InventoryValidationResult> {
  if (lines.length === 0) {
    return { valid: false, issues: [{ productId: '', error: 'Cart is empty' }] };
  }

  const productIds = lines.map((line) => line.productId);
  const { data, error } = await supabase
    .from('product_event_availability')
    .select('product_id, available_quantity_presale, reserved_quantity')
    .eq('event_id', marketId)
    .in('product_id', productIds);

  if (error) {
    return {
      valid: false,
      issues: [{ productId: '', error: error.message }],
    };
  }

  const availabilityByProduct = new Map(
    (data ?? []).map((row) => [
      row.product_id as string,
      Math.max(
        (row.available_quantity_presale ?? 0) - (row.reserved_quantity ?? 0),
        0,
      ),
    ]),
  );

  const issues: InventoryValidationIssue[] = [];
  for (const line of lines) {
    const maxQuantity = availabilityByProduct.get(line.productId);
    if (maxQuantity == null) {
      issues.push({
        productId: line.productId,
        productName: line.name,
        error: 'Not listed for this market',
      });
      continue;
    }
    if (line.quantity > maxQuantity) {
      issues.push({
        productId: line.productId,
        productName: line.name,
        error:
          maxQuantity === 0
            ? 'Out of presale stock'
            : `Only ${maxQuantity} available`,
        maxQuantity,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
