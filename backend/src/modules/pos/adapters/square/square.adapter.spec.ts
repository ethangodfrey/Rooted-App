import { createHmac } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import { SquareAdapter } from './square.adapter';

const CONFIG: Record<string, string> = {
  SQUARE_ENVIRONMENT: 'sandbox',
  SQUARE_APPLICATION_ID: 'app-id',
  SQUARE_APPLICATION_SECRET: 'app-secret',
  SQUARE_ACCESS_TOKEN: 'sandbox-app-access-token',
  PUBLIC_BASE_URL: 'https://api.test',
  SQUARE_WEBHOOK_SIGNATURE_KEY: 'sig-key',
};

function fakeConfig(): ConfigService {
  return {
    get: (key: string, def?: string) => (key in CONFIG ? CONFIG[key] : def),
  } as unknown as ConfigService;
}

describe('SquareAdapter', () => {
  const adapter = new SquareAdapter(fakeConfig());

  it('builds a sandbox OAuth authorize URL without session=false', () => {
    const url = adapter.getAuthorizeUrl({
      state: 'state-123',
      redirectUri: 'https://api.test/pos/oauth/square/callback',
    });
    expect(url).toContain('https://connect.squareupsandbox.com/oauth2/authorize');
    expect(url).toContain('client_id=app-id');
    expect(url).toContain('state=state-123');
    expect(url).toContain('ORDERS_READ');
    expect(url).not.toContain('session=false');
  });

  it('adds session=false for production OAuth', () => {
    const prod = new SquareAdapter({
      get: (key: string, def?: string) =>
        key === 'SQUARE_ENVIRONMENT' ? 'production' : CONFIG[key] ?? def,
    } as unknown as ConfigService);
    const url = prod.getAuthorizeUrl({
      state: 'state-123',
      redirectUri: 'https://api.test/pos/oauth/square/callback',
    });
    expect(url).toContain('connect.squareup.com/oauth2/authorize');
    expect(url).toContain('session=false');
  });

  describe('verifyWebhook', () => {
    const body = JSON.stringify({
      event_id: 'evt-1',
      type: 'order.updated',
      merchant_id: 'M1',
      data: { object: { order_id: 'O1', location_id: 'L1' } },
    });
    const notificationUrl = 'https://api.test/pos/webhooks/square';
    const validSignature = createHmac('sha256', 'sig-key')
      .update(notificationUrl + body)
      .digest('base64');

    it('accepts a valid signature and parses fields', () => {
      const parsed = adapter.verifyWebhook({
        rawBody: body,
        headers: { 'x-square-hmacsha256-signature': validSignature },
      });
      expect(parsed.signatureValid).toBe(true);
      expect(parsed.providerEventId).toBe('evt-1');
      expect(parsed.eventType).toBe('order.updated');
      expect(parsed.providerMerchantId).toBe('M1');
      expect(parsed.affectedTransactionIds).toEqual(['O1']);
    });

    it('rejects a tampered signature', () => {
      const parsed = adapter.verifyWebhook({
        rawBody: body,
        headers: { 'x-square-hmacsha256-signature': 'wrong-signature' },
      });
      expect(parsed.signatureValid).toBe(false);
    });

    it('rejects when the body is altered after signing', () => {
      const parsed = adapter.verifyWebhook({
        rawBody: body.replace('O1', 'O2'),
        headers: { 'x-square-hmacsha256-signature': validSignature },
      });
      expect(parsed.signatureValid).toBe(false);
    });
  });

  describe('registerWebhook', () => {
    it('creates a subscription and returns its id + signature key', async () => {
      const http = (adapter as unknown as { http: { get: jest.Mock; post: jest.Mock } }).http;
      const get = jest.spyOn(http, 'get').mockResolvedValue({ data: { subscriptions: [] } } as never);
      const post = jest.spyOn(http, 'post').mockResolvedValue({
        data: { subscription: { id: 'wbhk_1', signature_key: 'per-sub-key' } },
      } as never);

      const result = await adapter.registerWebhook(
        { accessToken: 'merchant-oauth-tok' },
        'https://api.test/pos/webhooks/square',
      );

      expect(result).toEqual({ id: 'wbhk_1', secret: 'per-sub-key' });
      expect(get.mock.calls[0][1]?.headers?.Authorization).toBe(
        'Bearer sandbox-app-access-token',
      );
      const [url, body, opts] = post.mock.calls[0];
      expect(url).toBe('/v2/webhooks/subscriptions');
      expect(opts?.headers?.Authorization).toBe('Bearer sandbox-app-access-token');
      expect(body.subscription.notification_url).toBe('https://api.test/pos/webhooks/square');
      expect(body.subscription.event_types).toContain('payment.updated');
      expect(body.idempotency_key).toBeTruthy();
      get.mockRestore();
      post.mockRestore();
    });

    it('reuses an existing subscription for the same notification URL', async () => {
      const http = (adapter as unknown as { http: { get: jest.Mock; post: jest.Mock } }).http;
      const get = jest.spyOn(http, 'get').mockResolvedValue({
        data: {
          subscriptions: [
            {
              id: 'wbhk_existing',
              signature_key: 'existing-key',
              notification_url: 'https://api.test/pos/webhooks/square',
            },
          ],
        },
      } as never);
      const post = jest.spyOn(http, 'post');

      const result = await adapter.registerWebhook(
        { accessToken: 'merchant-oauth-tok' },
        'https://api.test/pos/webhooks/square',
      );

      expect(result).toEqual({ id: 'wbhk_existing', secret: 'existing-key' });
      expect(post).not.toHaveBeenCalled();
      get.mockRestore();
      post.mockRestore();
    });

    it('throws when the subscription has no id', async () => {
      const http = (adapter as unknown as { http: { get: jest.Mock; post: jest.Mock } }).http;
      const get = jest.spyOn(http, 'get').mockResolvedValue({ data: { subscriptions: [] } } as never);
      const post = jest.spyOn(http, 'post').mockResolvedValue({ data: { subscription: {} } } as never);

      await expect(
        adapter.registerWebhook({ accessToken: 'tok' }, 'https://api.test/pos/webhooks/square'),
      ).rejects.toThrow(/did not include an id/);
      get.mockRestore();
      post.mockRestore();
    });
  });

  describe('deleteWebhook', () => {
    it('calls DELETE on the subscription id', async () => {
      const del = jest
        .spyOn((adapter as unknown as { http: { delete: jest.Mock } }).http, 'delete')
        .mockResolvedValue({ data: {} } as never);

      await adapter.deleteWebhook({ accessToken: 'merchant-oauth-tok' }, 'wbhk_1');

      expect(del.mock.calls[0][0]).toBe('/v2/webhooks/subscriptions/wbhk_1');
      expect(del.mock.calls[0][1]?.headers?.Authorization).toBe(
        'Bearer sandbox-app-access-token',
      );
      del.mockRestore();
    });
  });
});
