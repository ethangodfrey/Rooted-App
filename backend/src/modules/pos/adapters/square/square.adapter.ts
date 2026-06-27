import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, type AxiosInstance } from 'axios';

import { POS_DEFAULTS } from '../../pos.constants';
import { posWebhookUrl } from '../../pos-public-url';
import type {
  NormalizedLineItem,
  NormalizedTransaction,
  NormalizedTransactionState,
  TransactionPage,
} from '../../types/normalized-transaction';
import type {
  ApiKeyValidationResult,
  FetchTransactionsParams,
  OAuthAuthorizeRequest,
  OAuthTokenResult,
  ParsedWebhook,
  ProviderCatalogItem,
  ProviderCredentials,
  ProviderLocation,
  RegisterWebhookResult,
  WebhookVerificationInput,
} from '../../types/provider.types';
import { resolvePosLineItemName } from '../../utils/pos-line-item.util';
import type { PosProviderAdapter } from '../provider-adapter.interface';

/**
 * Square adapter (OAuth2). Imports card sales via the Orders Search API.
 *
 * References (verify against your pinned Square-Version):
 *  - OAuth: https://developer.squareup.com/docs/oauth-api/overview
 *  - Orders search: POST /v2/orders/search
 *  - Webhook signatures: HMAC-SHA256 over (notificationUrl + rawBody), base64.
 */
@Injectable()
export class SquareAdapter implements PosProviderAdapter {
  readonly provider = 'SQUARE' as const;
  readonly authType = 'OAUTH' as const;

  private readonly logger = new Logger(SquareAdapter.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly apiVersion: string;

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('SQUARE_ENVIRONMENT', 'sandbox');
    this.baseUrl =
      env === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
    this.appId = this.config.get<string>('SQUARE_APPLICATION_ID', '');
    this.appSecret = this.config.get<string>('SQUARE_APPLICATION_SECRET', '');
    // Pin a Square-Version; override via env as Square releases new versions.
    this.apiVersion = this.config.get<string>('SQUARE_API_VERSION', '2024-12-18');
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 20_000,
      headers: { 'Square-Version': this.apiVersion },
    });
  }

  getAuthorizeUrl(request: OAuthAuthorizeRequest): string {
    if (!this.appId) {
      throw new NotImplementedException('SQUARE_APPLICATION_ID is not configured.');
    }
    const scopes = request.scopes ?? ['ORDERS_READ', 'PAYMENTS_READ', 'MERCHANT_PROFILE_READ'];
    const params = new URLSearchParams({
      client_id: this.appId,
      scope: scopes.join(' '),
      state: request.state,
      redirect_uri: request.redirectUri,
    });
    // Sandbox only supports session=true (default). Production requires session=false.
    const isProduction = this.config.get<string>('SQUARE_ENVIRONMENT', 'sandbox') === 'production';
    if (isProduction) {
      params.set('session', 'false');
    }
    return `${this.baseUrl}/oauth2/authorize?${params.toString()}`;
  }

  async exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const data = await this.request<any>('oauth.token', () =>
      this.http.post('/oauth2/token', {
        client_id: this.appId,
        client_secret: this.appSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at ?? null,
      merchantId: data.merchant_id,
    };
  }

  async refreshAccessToken(credentials: ProviderCredentials): Promise<OAuthTokenResult> {
    const data = await this.request<any>('oauth.refresh', () =>
      this.http.post('/oauth2/token', {
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
      }),
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      expiresAt: data.expires_at ?? null,
      merchantId: data.merchant_id,
    };
  }

  validateApiKey(): Promise<ApiKeyValidationResult> {
    throw new NotImplementedException('Square uses OAuth, not API keys.');
  }

  async listLocations(credentials: ProviderCredentials): Promise<ProviderLocation[]> {
    const data = await this.request<any>('locations.list', () =>
      this.http.get('/v2/locations', { headers: this.authHeader(credentials) }),
    );
    return (data.locations ?? [])
      .filter((l: any) => l?.id)
      .map((l: any) => ({ id: l.id, name: l.name ?? l.id }));
  }

  async listCatalogItems(credentials: ProviderCredentials): Promise<ProviderCatalogItem[]> {
    const data = await this.request<any>('catalog.list', () =>
      this.http.get('/v2/catalog/list', {
        headers: this.authHeader(credentials),
        params: { types: 'ITEM' },
      }),
    );
    return (data.objects ?? []).map((o: any) => ({
      id: o.id,
      name: o.item_data?.name ?? 'Unknown',
    }));
  }

  async fetchTransactions(params: FetchTransactionsParams): Promise<TransactionPage> {
    const locationIds = await this.resolveLocationIds(params);
    if (locationIds.length === 0) {
      this.logger.warn('Square fetchTransactions: no locations resolved; returning empty page.');
      return { transactions: [], nextCursor: null };
    }

    const body: Record<string, unknown> = {
      location_ids: locationIds,
      limit: params.pageSize ?? POS_DEFAULTS.PAGE_SIZE,
      cursor: params.cursor ?? undefined,
      query: {
        filter: {
          date_time_filter: {
            closed_at: { start_at: params.since, end_at: params.until },
          },
          state_filter: { states: ['COMPLETED'] },
        },
        sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' },
      },
    };

    const data = await this.request<any>('orders.search', () =>
      this.http.post('/v2/orders/search', body, { headers: this.authHeader(params.credentials) }),
    );

    const orders = await this.hydrateOrderLineItems(params.credentials, data.orders ?? []);
    const transactions: NormalizedTransaction[] = orders.map((order: any) =>
      this.normalizeOrder(order),
    );
    return { transactions, nextCursor: data.cursor ?? null };
  }

  /** Search results sometimes omit line_items — batch-retrieve fills them in. */
  private async hydrateOrderLineItems(
    credentials: ProviderCredentials,
    orders: any[],
  ): Promise<any[]> {
    const missing = orders.filter((o) => !o?.line_items?.length).map((o) => o.id);
    if (missing.length === 0) return orders;

    const hydrated = new Map<string, any>();
    const chunkSize = 50;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      const data = await this.request<any>('orders.batchRetrieve', () =>
        this.http.post(
          '/v2/orders/batch-retrieve',
          { order_ids: chunk },
          { headers: this.authHeader(credentials) },
        ),
      );
      for (const order of data.orders ?? []) {
        if (order?.id) hydrated.set(order.id, order);
      }
    }

    return orders.map((order) => hydrated.get(order.id) ?? order);
  }

  verifyWebhook(input: WebhookVerificationInput): ParsedWebhook {
    const signatureKey =
      input.secret ?? this.config.get<string>('SQUARE_WEBHOOK_SIGNATURE_KEY', '');
    const notificationUrl = posWebhookUrl(this.config, 'SQUARE');
    const provided = input.headers['x-square-hmacsha256-signature'] ?? '';
    const raw = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : input.rawBody;

    let signatureValid = false;
    if (signatureKey && provided) {
      const expected = createHmac('sha256', signatureKey)
        .update(notificationUrl + raw)
        .digest('base64');
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        signatureValid = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        signatureValid = false;
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(raw || '{}');
    } catch {
      payload = {};
    }

    const object = payload.data?.object ?? {};
    const orderId: string | undefined =
      object.order_id ?? object.order?.id ?? object.payment?.order_id;

    return {
      providerEventId: payload.event_id ?? payload.id ?? '',
      eventType: payload.type ?? 'unknown',
      signatureValid,
      providerMerchantId: payload.merchant_id,
      providerLocationId: object.location_id ?? object.payment?.location_id,
      affectedTransactionIds: orderId ? [orderId] : undefined,
    };
  }

  /**
   * Creates a Square Webhook Subscription pointed at our receiver and returns the
   * subscription id + its per-subscription `signature_key` (stored as the
   * connection's webhook secret for byte-for-byte signature verification).
   *
   * The event types below must also be enabled on the Square application's
   * Webhooks configuration. TODO: verify the enabled set against your app config.
   */
  /**
   * Square webhook subscriptions are application-scoped and must be managed with
   * the app's access token from the Developer Dashboard — not a merchant OAuth
   * token. One subscription covers all sellers who authorize this application.
   */
  async registerWebhook(
    _credentials: ProviderCredentials,
    callbackUrl: string,
  ): Promise<RegisterWebhookResult> {
    const headers = this.applicationAuthHeader();
    const existing = await this.findWebhookSubscription(callbackUrl, headers);
    if (existing?.id) {
      return {
        id: existing.id,
        secret: existing.signature_key ?? this.globalWebhookSignatureKey(),
      };
    }

    const data = await this.request<any>('webhooks.create', () =>
      this.http.post(
        '/v2/webhooks/subscriptions',
        {
          idempotency_key: randomUUID(),
          subscription: {
            name: 'Vendorly POS sync',
            event_types: this.webhookEventTypes(),
            notification_url: callbackUrl,
            api_version: this.apiVersion,
          },
        },
        { headers },
      ),
    );
    const subscription = data.subscription ?? {};
    if (!subscription.id) {
      throw new Error('Square webhook subscription response did not include an id.');
    }
    return {
      id: subscription.id,
      secret: subscription.signature_key ?? this.globalWebhookSignatureKey(),
    };
  }

  async deleteWebhook(_credentials: ProviderCredentials, subscriptionId: string): Promise<void> {
    await this.request<any>('webhooks.delete', () =>
      this.http.delete(`/v2/webhooks/subscriptions/${subscriptionId}`, {
        headers: this.applicationAuthHeader(),
      }),
    );
  }

  // --- helpers ---

  /** Sales + refund + order events that should drive an incremental sync. */
  private webhookEventTypes(): string[] {
    const configured = this.config.get<string>('SQUARE_WEBHOOK_EVENT_TYPES', '');
    if (configured.trim()) {
      return configured
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [
      'payment.created',
      'payment.updated',
      'refund.created',
      'refund.updated',
      'order.created',
      'order.updated',
      'order.fulfillment.updated',
    ];
  }

  private authHeader(credentials: ProviderCredentials): Record<string, string> {
    return { Authorization: `Bearer ${credentials.accessToken ?? ''}` };
  }

  private applicationAccessToken(): string {
    const token = this.config.get<string>('SQUARE_ACCESS_TOKEN', '').trim();
    if (!token) {
      throw new Error(
        'SQUARE_ACCESS_TOKEN is not configured. In the Square Developer Dashboard, open Credentials and copy the Sandbox (or Production) access token into backend/.env, then restart the server.',
      );
    }
    return token;
  }

  private applicationAuthHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.applicationAccessToken()}` };
  }

  private globalWebhookSignatureKey(): string | undefined {
    const key = this.config.get<string>('SQUARE_WEBHOOK_SIGNATURE_KEY', '').trim();
    return key || undefined;
  }

  private async findWebhookSubscription(
    callbackUrl: string,
    headers: Record<string, string>,
  ): Promise<{ id?: string; signature_key?: string } | null> {
    try {
      const data = await this.request<any>('webhooks.list', () =>
        this.http.get('/v2/webhooks/subscriptions', { headers }),
      );
      const match = (data.subscriptions ?? []).find(
        (s: { notification_url?: string }) => s.notification_url === callbackUrl,
      );
      return match ?? null;
    } catch {
      return null;
    }
  }

  /** Square Orders Search requires location_ids; resolve them if not provided. */
  private async resolveLocationIds(params: FetchTransactionsParams): Promise<string[]> {
    if (params.locationId) return [params.locationId];
    try {
      const locations = await this.listLocations(params.credentials);
      // Orders Search accepts up to 10 location ids per request.
      return locations.slice(0, 10).map((l) => l.id);
    } catch (err) {
      this.logger.error(`Square location resolution failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async request<T>(desc: string, fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const res = await fn();
      return res.data;
    } catch (err) {
      const ax = err as AxiosError;
      const status = ax.response?.status;
      const detail =
        (ax.response?.data && JSON.stringify(ax.response.data)) || ax.message || 'unknown error';
      throw new Error(`Square ${desc} failed${status ? ` (HTTP ${status})` : ''}: ${detail}`);
    }
  }

  private mapState(state: string | undefined): NormalizedTransactionState {
    switch (state) {
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELED':
        return 'VOIDED';
      default:
        return 'COMPLETED';
    }
  }

  private normalizeOrder(order: any): NormalizedTransaction {
    let lineItems: NormalizedLineItem[] = (order.line_items ?? []).map((li: any) => {
      const grossAmount = this.toCents(li.gross_sales_money?.amount ?? li.total_money?.amount);
      return {
        providerLineItemId: li.uid,
        providerCatalogObjectId: li.catalog_object_id,
        name: resolvePosLineItemName(li.name ?? li.variation_name, grossAmount, li),
        quantity: this.parseQuantity(li.quantity),
        unitPrice: this.toCents(li.base_price_money?.amount),
        grossAmount,
        discountAmount: this.toCents(li.total_discount_money?.amount),
        taxAmount: this.toCents(li.total_tax_money?.amount),
        raw: li,
      };
    });

    if (lineItems.length === 0) {
      const net = this.toCents(
        order.net_amounts?.total_money?.amount ?? order.total_money?.amount,
      );
      if (net > 0) {
        lineItems = [
          {
            name: 'Register sale',
            quantity: 1,
            unitPrice: net,
            grossAmount: net,
            raw: order,
          },
        ];
      }
    }

    const tenders: any[] = order.tenders ?? [];
    const tipAmount = tenders.reduce(
      (sum, t) => sum + this.toCents(t.tip_money?.amount),
      0,
    );
    const refundedAmount = this.toCents(order.refunded_money?.amount);
    const totalAmount = this.toCents(order.total_money?.amount);

    let state = this.mapState(order.state);
    if (state === 'COMPLETED' && refundedAmount > 0) {
      state = refundedAmount >= totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    }

    return {
      providerTransactionId: order.id,
      providerOrderId: order.id,
      providerLocationId: order.location_id,
      state,
      soldAt: order.closed_at ?? order.created_at ?? new Date().toISOString(),
      currency: order.total_money?.currency ?? 'USD',
      grossAmount: totalAmount,
      discountAmount: this.toCents(order.total_discount_money?.amount),
      taxAmount: this.toCents(order.total_tax_money?.amount),
      tipAmount,
      netAmount: this.toCents(
        order.net_amounts?.total_money?.amount ?? order.total_money?.amount,
      ),
      tenderType: tenders[0]?.type === 'CASH' ? 'CASH' : 'CARD',
      cardBrand: tenders[0]?.card_details?.card?.card_brand,
      lineItems,
      raw: order,
    };
  }

  /** Square money amounts are integer cents (BigInt-safe via Number). */
  private toCents(amount: unknown): number {
    if (amount == null) return 0;
    const n = Number(amount);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  private parseQuantity(quantity: unknown): number {
    const n = Number(quantity ?? '1');
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
}
