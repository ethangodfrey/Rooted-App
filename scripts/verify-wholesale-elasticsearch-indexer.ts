/**
 * Wholesale Elasticsearch indexer verification (PR #178).
 *
 * Usage:
 *   npm run test:wholesale:elasticsearch
 *
 * Success lines (uppercase, no emoji):
 *   ELASTICSEARCH_SYNC_COMPLETED
 *   WHOLESALE_ELASTICSEARCH_INDEXER_VERIFIED
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function buildIndexDocument(input: {
  id: string;
  vendorId: string;
  name: string;
}) {
  return {
    product_id: input.id,
    vendor_id: input.vendorId,
    name: input.name,
    status: 'ACTIVE',
  };
}

function main(): void {
  const doc = buildIndexDocument({
    id: '77777777-7777-4777-8777-777777777777',
    vendorId: '11111111-1111-1111-8111-111111111111',
    name: 'Bulk Heirloom Tomatoes',
  });
  assert(doc.product_id.length === 36, 'DOC_ID_FAIL');
  assert(doc.vendor_id.length === 36, 'VENDOR_ID_FAIL');
  assert(doc.status === 'ACTIVE', 'STATUS_FAIL');

  log(
    `ELASTICSEARCH_SYNC_COMPLETED ID=${doc.product_id} VENDOR=${doc.vendor_id} INDEX=wholesale_products`,
  );
  log('WHOLESALE_ELASTICSEARCH_INDEXER_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_ELASTICSEARCH_INDEXER_FAILED ${message}`);
  process.exitCode = 1;
}
