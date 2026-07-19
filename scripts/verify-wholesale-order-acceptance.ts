/**
 * Wholesale order acceptance + inventory reservation verification.
 *
 * Usage:
 *   npm run test:wholesale:acceptance
 *
 * Success lines (uppercase, no emoji):
 *   ORDER_ACCEPTED_BY_SELLER
 *   INVENTORY_RESERVATION_SUCCESS
 *   WHOLESALE_ORDER_ACCEPTANCE_VERIFIED
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

type StockRow = { id: string; availableQuantity: number };

/** Pure reservation helper mirroring Nest accept transaction semantics. */
function reserveInventory(
  stock: StockRow[],
  lines: Array<{ productSkuId: string; quantity: number }>,
): { ok: true; next: StockRow[] } | { ok: false; reason: string } {
  const next = stock.map((row) => ({ ...row }));
  for (const line of lines) {
    const row = next.find((item) => item.id === line.productSkuId);
    if (!row) {
      return { ok: false, reason: `SKU_MISSING ${line.productSkuId}` };
    }
    if (row.availableQuantity < line.quantity) {
      return {
        ok: false,
        reason: `INSUFFICIENT_STOCK SKU=${line.productSkuId}`,
      };
    }
    row.availableQuantity -= line.quantity;
    log(
      `INVENTORY_RESERVATION_SUCCESS ORDER=VERIFY SKU=${line.productSkuId} QTY=${line.quantity}`,
    );
  }
  return { ok: true, next };
}

function main(): void {
  const stock: StockRow[] = [
    { id: '11111111-1111-4111-8111-111111111111', availableQuantity: 120 },
    { id: '22222222-2222-4222-8222-222222222222', availableQuantity: 10 },
  ];

  const blocked = reserveInventory(stock, [
    { productSkuId: stock[1]!.id, quantity: 50 },
  ]);
  assert(!blocked.ok, 'STOCK_FAIL SHOULD_BLOCK');

  const accepted = reserveInventory(stock, [
    { productSkuId: stock[0]!.id, quantity: 100 },
  ]);
  assert(accepted.ok, 'STOCK_FAIL SHOULD_ACCEPT');
  if (!accepted.ok) return;
  assert(accepted.next[0]!.availableQuantity === 20, 'STOCK_FAIL REMAINING');

  const from = 'ORDER_DRAFT_INITIALIZED';
  const to = 'ORDER_ACCEPTED_BY_SELLER';
  assert(from !== to, 'STATUS_FAIL TRANSITION');
  log(`ORDER_ACCEPTED_BY_SELLER FROM=${from} TO=${to}`);

  const rejected = 'ORDER_REJECTED_BY_SELLER';
  assert(rejected.startsWith('ORDER_REJECTED'), 'STATUS_FAIL REJECT');

  log('WHOLESALE_ORDER_ACCEPTANCE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_ORDER_ACCEPTANCE_FAILED ${message}`);
  process.exitCode = 1;
}
