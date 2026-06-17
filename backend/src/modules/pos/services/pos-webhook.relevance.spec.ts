import { isWebhookSyncRelevant } from './pos-webhook.service';

describe('isWebhookSyncRelevant', () => {
  it('treats payment/refund/order events as sync-relevant', () => {
    expect(isWebhookSyncRelevant('payment.created')).toBe(true);
    expect(isWebhookSyncRelevant('payment.updated')).toBe(true);
    expect(isWebhookSyncRelevant('refund.created')).toBe(true);
    expect(isWebhookSyncRelevant('order.updated')).toBe(true);
    expect(isWebhookSyncRelevant('order.fulfillment.updated')).toBe(true);
  });

  it('ignores unrelated events', () => {
    expect(isWebhookSyncRelevant('customer.created')).toBe(false);
    expect(isWebhookSyncRelevant('inventory.count.updated')).toBe(false);
    expect(isWebhookSyncRelevant('oauth.authorization.revoked')).toBe(false);
    expect(isWebhookSyncRelevant('unknown')).toBe(false);
  });
});
