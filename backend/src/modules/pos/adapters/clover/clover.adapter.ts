import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

import { POS_DEFAULTS } from '../../pos.constants';
import type {
  NormalizedTransaction,
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
  WebhookVerificationInput,
} from '../../types/provider.types';
import type { PosProviderAdapter } from '../provider-adapter.interface';

/**
 * Clover adapter (OAuth2). Reads orders/payments scoped to a merchant id.
 *
 * References (verify against current Clover API):
 *  - OAuth: https://docs.clover.com/docs/using-oauth-20
 *  - Orders: GET /v3/merchants/{mId}/orders
 *  - Payments: GET /v3/merchants/{mId}/payments
 *  - Webhooks: verified via the app's webhook verification code / signature.
 */
@Injectable()
export class CloverAdapter implements PosProviderAdapter {
  readonly provider = 'CLOVER' as const;
  readonly authType = 'OAUTH' as const;

  private readonly logger = new Logger(CloverAdapter.name);
  private readonly http: AxiosInstance;
  private readonly apiBaseUrl: string;
  private readonly oauthBaseUrl: string;
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('CLOVER_ENVIRONMENT', 'sandbox');
    // TODO: verify with provider docs — confirm regional/prod/sandbox hosts.
    this.apiBaseUrl =
      env === 'production' ? 'https://api.clover.com' : 'https://sandbox.dev.clover.com';
    this.oauthBaseUrl =
      env === 'production' ? 'https://www.clover.com' : 'https://sandbox.dev.clover.com';
    this.appId = this.config.get<string>('CLOVER_APP_ID', '');
    this.appSecret = this.config.get<string>('CLOVER_APP_SECRET', '');
    this.http = axios.create({ baseURL: this.apiBaseUrl, timeout: 20_000 });
  }

  getAuthorizeUrl(request: OAuthAuthorizeRequest): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      response_type: 'code',
      redirect_uri: request.redirectUri,
      state: request.state,
    });
    return `${this.oauthBaseUrl}/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    // Clover OAuth v2 token exchange. TODO: verify with provider docs (payload).
    const { data } = await this.http.post(`${this.oauthBaseUrl}/oauth/v2/token`, {
      client_id: this.appId,
      client_secret: this.appSecret,
      code,
      redirect_uri: redirectUri,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.access_token_expiration
        ? new Date(data.access_token_expiration * 1000).toISOString()
        : null,
      merchantId: data.merchant_id,
    };
  }

  async refreshAccessToken(credentials: ProviderCredentials): Promise<OAuthTokenResult> {
    // TODO: verify with provider docs — Clover refresh token support varies by
    // app configuration (OAuth v2 vs legacy permanent tokens).
    const { data } = await this.http.post(`${this.oauthBaseUrl}/oauth/v2/refresh`, {
      client_id: this.appId,
      refresh_token: credentials.refreshToken,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      expiresAt: data.access_token_expiration
        ? new Date(data.access_token_expiration * 1000).toISOString()
        : null,
    };
  }

  validateApiKey(): Promise<ApiKeyValidationResult> {
    throw new NotImplementedException('Clover uses OAuth, not API keys.');
  }

  async listLocations(credentials: ProviderCredentials): Promise<ProviderLocation[]> {
    // Clover access tokens are merchant-scoped; the "location" is the merchant.
    const merchantId = credentials.expiresAt ? undefined : undefined; // placeholder
    void merchantId;
    return [];
  }

  async listCatalogItems(
    credentials: ProviderCredentials,
    locationId?: string,
  ): Promise<ProviderCatalogItem[]> {
    const merchantId = locationId;
    if (!merchantId) return [];
    const { data } = await this.http.get(`/v3/merchants/${merchantId}/items`, {
      headers: this.authHeader(credentials),
      params: { limit: 1000 },
    });
    return (data.elements ?? []).map((i: any) => ({ id: i.id, name: i.name, sku: i.sku }));
  }

  async fetchTransactions(params: FetchTransactionsParams): Promise<TransactionPage> {
    const merchantId = params.locationId;
    if (!merchantId) {
      return { transactions: [], nextCursor: null };
    }
    const offset = params.cursor ? Number(params.cursor) : 0;
    const pageSize = params.pageSize ?? POS_DEFAULTS.PAGE_SIZE;
    const sinceMs = new Date(params.since).getTime();
    const untilMs = params.until ? new Date(params.until).getTime() : Date.now();

    // Clover filters use a Lucene-style `filter` param on epoch millis.
    const { data } = await this.http.get(`/v3/merchants/${merchantId}/orders`, {
      headers: this.authHeader(credentials(params)),
      params: {
        filter: `clientCreatedTime>=${sinceMs} AND clientCreatedTime<=${untilMs}`,
        expand: 'lineItems,payments',
        limit: pageSize,
        offset,
      },
    });

    const orders: any[] = data.elements ?? [];
    const transactions = orders.map((o) => this.normalizeOrder(o, merchantId));
    const nextCursor = orders.length >= pageSize ? String(offset + pageSize) : null;
    return { transactions, nextCursor };
  }

  verifyWebhook(input: WebhookVerificationInput): ParsedWebhook {
    // TODO: verify with provider docs — Clover webhook verification commonly uses
    // a verification code handshake plus signature; confirm header name.
    const secret = input.secret ?? this.config.get<string>('CLOVER_WEBHOOK_SECRET', '');
    const provided = input.headers['x-clover-auth'] ?? '';
    const raw = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : input.rawBody;
    const expected = createHmac('sha256', secret).update(raw).digest('hex');

    let signatureValid = false;
    try {
      signatureValid =
        provided.length > 0 && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch {
      signatureValid = false;
    }

    const payload = JSON.parse(raw || '{}');
    const merchants = payload.merchants ?? {};
    const merchantId = Object.keys(merchants)[0];
    const objectId: string | undefined = merchants[merchantId]?.[0]?.objectId;
    return {
      providerEventId: `${merchantId ?? ''}:${objectId ?? ''}:${payload.ts ?? ''}`,
      eventType: merchants[merchantId]?.[0]?.type ?? 'unknown',
      signatureValid,
      providerMerchantId: merchantId,
      providerLocationId: merchantId,
      affectedTransactionIds: objectId ? [objectId.replace(/^O:/, '')] : undefined,
    };
  }

  private authHeader(credentials: ProviderCredentials): Record<string, string> {
    return { Authorization: `Bearer ${credentials.accessToken ?? ''}` };
  }

  private normalizeOrder(order: any, merchantId: string): NormalizedTransaction {
    const lineItems = (order.lineItems?.elements ?? []).map((li: any) => ({
      providerLineItemId: li.id,
      providerCatalogObjectId: li.item?.id,
      name: li.name ?? 'Item',
      quantity: Number(li.unitQty ? li.unitQty / 1000 : 1) || 1,
      unitPrice: Number(li.price ?? 0),
      grossAmount: Number(li.price ?? 0),
      raw: li,
    }));

    const payments = order.payments?.elements ?? [];
    const tip = payments.reduce((s: number, p: any) => s + Number(p.tipAmount ?? 0), 0);
    const card = payments[0]?.cardTransaction?.cardType;

    return {
      providerTransactionId: order.id,
      providerOrderId: order.id,
      providerLocationId: merchantId,
      state: order.state === 'open' ? 'COMPLETED' : 'COMPLETED',
      soldAt: order.clientCreatedTime
        ? new Date(order.clientCreatedTime).toISOString()
        : new Date(order.createdTime ?? Date.now()).toISOString(),
      currency: order.currency ?? 'USD',
      grossAmount: Number(order.total ?? 0),
      discountAmount: 0,
      taxAmount: Number(order.taxAmount ?? 0),
      tipAmount: tip,
      netAmount: Number(order.total ?? 0),
      tenderType: payments.length ? 'CARD' : 'OTHER',
      cardBrand: card,
      lineItems,
      raw: order,
    };
  }
}

function credentials(params: FetchTransactionsParams): ProviderCredentials {
  return params.credentials;
}
