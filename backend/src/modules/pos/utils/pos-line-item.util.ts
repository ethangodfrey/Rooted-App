/** Human-readable label for a Square / POS line item. */
export function resolvePosLineItemName(
  name: string | null | undefined,
  grossAmountCents: number,
  rawPayload?: unknown,
): string {
  const raw =
    rawPayload && typeof rawPayload === 'object'
      ? (rawPayload as Record<string, unknown>)
      : null;
  const trimmed = (name ?? '').trim();
  const generic =
    trimmed.length === 0 || trimmed === 'Item' || trimmed === 'Register item';

  if (generic && raw?.item_type === 'CUSTOM_AMOUNT') {
    return `Quick sale · ${formatUsd(grossAmountCents)}`;
  }

  if (generic && raw?.item_type === 'ITEM') {
    const catalogName = raw.name ?? raw.variation_name;
    if (typeof catalogName === 'string' && catalogName.trim()) return catalogName.trim();
  }

  if (trimmed.length > 0) return trimmed;
  if (grossAmountCents > 0) return `Sale · ${formatUsd(grossAmountCents)}`;
  return 'Register item';
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
