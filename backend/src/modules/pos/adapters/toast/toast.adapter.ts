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
 * Toast adapter.
 *
 * Toast partner integrations authenticate machine-to-machine with a client
 * credentials grant and operate against a specific restaurant GUID (location).
 * TODO: verify with provider docs — Toast requires partner onboarding; the exact
 * auth flow, scopes, endpoints, and signature scheme below must be confirmed.
 */
@Injectable()
export class ToastAdapter implements PosProviderAdapter {
  readonly provider = 'TOAST' as const;
  // Modeled as API_KEY (client credentials) rather than user-facing OAuth.
  readonly authType = 'API_KEY' as const;

  private readonly logger = new Logger(ToastAdapter.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('TOAST_ENVIRONMENT', 'sandbox');
    // TODO: verify with provider docs — confirm production/sandbox hostnames.
    this.baseUrl =
      env === 'production' ? 'https://ws-api.toasttab.com' : 'https://ws-sandbox-api.toasttab.com';
    this.http = axios.create({ baseURL: this.baseUrl, timeout: 20_000 });
  }

  getAuthorizeUrl(_request: OAuthAuthorizeRequest): string {
    throw new NotImplementedException(
      'Toast uses partner client-credentials auth, not user OAuth redirect. TODO: verify with provider docs',
    );
  }

  exchangeOAuthCode(): Promise<OAuthTokenResult> {
    throw new NotImplementedException('Not applicable for Toast. TODO: verify with provider docs');
  }

  async refreshAccessToken(credentials: ProviderCredentials): Promise<OAuthTokenResult> {
    // Toast: exchange client credentials for a short-lived access token.
    // TODO: verify with provider docs — endpoint + body shape.
    const { data } = await this.http.post('/authentication/v1/authentication/login', {
      clientId: this.config.get<string>('TOAST_CLIENT_ID'),
      clientSecret: this.config.get<string>('TOAST_CLIENT_SECRET'),
      userAccessType: 'TOAST_MACHINE_CLIENT',
    });
    void credentials;
    return {
      accessToken: data.token?.accessToken,
      expiresAt: data.token?.expiresAt ?? null,
    };
  }

  async validateApiKey(credentials: ProviderCredentials): Promise<ApiKeyValidationResult> {
    // Validate by resolving the configured restaurant (location) GUID.
    // TODO: verify with provider docs.
    const restaurantGuid = credentials.apiKey; // restaurant GUID stored as apiKey
    return { merchantId: restaurantGuid, locationId: restaurantGuid };
  }

  async listLocations(credentials: ProviderCredentials): Promise<ProviderLocation[]> {
    // TODO: verify with provider docs — partners are typically scoped to known
    // restaurant GUIDs supplied during onboarding.
    const guid = credentials.apiKey ?? '';
    return guid ? [{ id: guid, name: 'Toast Restaurant' }] : [];
  }

  async listCatalogItems(credentials: ProviderCredentials): Promise<ProviderCatalogItem[]> {
    // GET /menus/v2/menus then flatten menu items. TODO: verify with provider docs.
    void credentials;
    return [];
  }

  async fetchTransactions(params: FetchTransactionsParams): Promise<TransactionPage> {
    // Toast Orders API: GET /orders/v2/ordersBulk?startDate&endDate&page
    // paginated by page number rather than opaque cursor.
    // TODO: verify with provider docs — params, headers, and pagination.
    const page = params.cursor ? Number(params.cursor) : 1;
    const { data } = await this.http.get('/orders/v2/ordersBulk', {
      headers: {
        Authorization: `Bearer ${params.credentials.accessToken ?? ''}`,
        'Toast-Restaurant-External-ID': params.locationId ?? params.credentials.apiKey ?? '',
      },
      params: {
        startDate: params.since,
        endDate: params.until,
        page,
        pageSize: params.pageSize ?? POS_DEFAULTS.PAGE_SIZE,
      },
    });

    const orders: any[] = Array.isArray(data) ? data : (data.orders ?? []);
    const transactions: NormalizedTransaction[] = orders.map((o) => this.normalizeOrder(o));
    const nextCursor = orders.length >= (params.pageSize ?? POS_DEFAULTS.PAGE_SIZE)
      ? String(page + 1)
      : null;
    return { transactions, nextCursor };
  }

  verifyWebhook(input: WebhookVerificationInput): ParsedWebhook {
    // TODO: verify with provider docs — Toast webhook signature header/scheme.
    const secret = input.secret ?? this.config.get<string>('TOAST_WEBHOOK_SECRET', '');
    const provided = input.headers['toast-signature'] ?? '';
    const raw = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : input.rawBody;
    const expected = createHmac('sha256', secret).update(raw).digest('base64');

    let signatureValid = false;
    try {
      signatureValid =
        provided.length > 0 && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch {
      signatureValid = false;
    }

    const payload = JSON.parse(raw || '{}');
    return {
      providerEventId: payload.eventId ?? payload.guid ?? '',
      eventType: payload.eventType ?? 'unknown',
      signatureValid,
      providerMerchantId: payload.restaurantGuid,
      providerLocationId: payload.restaurantGuid,
    };
  }

  private normalizeOrder(order: any): NormalizedTransaction {
    // TODO: verify with provider docs — Toast money fields are typically decimal
    // dollars; convert to integer cents.
    const checks: any[] = order.checks ?? [];
    const toCents = (v: number | undefined) => Math.round((v ?? 0) * 100);
    const gross = checks.reduce((s, c) => s + toCents(c.totalAmount), 0);
    const tax = checks.reduce((s, c) => s + toCents(c.taxAmount), 0);
    const tip = checks.reduce((s, c) => s + toCents(c.tipAmount), 0);

    const lineItems = checks.flatMap((c) =>
      (c.selections ?? []).map((sel: any) => ({
        providerLineItemId: sel.guid,
        providerCatalogObjectId: sel.item?.guid,
        name: sel.displayName ?? 'Item',
        quantity: Number(sel.quantity ?? 1),
        unitPrice: toCents(sel.price),
        grossAmount: toCents(sel.preDiscountPrice ?? sel.price),
        taxAmount: toCents(sel.tax),
        raw: sel,
      })),
    );

    return {
      providerTransactionId: order.guid,
      providerOrderId: order.guid,
      providerLocationId: order.restaurantGuid,
      state: order.voided ? 'VOIDED' : 'COMPLETED',
      soldAt: order.closedDate ?? order.openedDate ?? new Date().toISOString(),
      currency: 'USD',
      grossAmount: gross,
      discountAmount: 0,
      taxAmount: tax,
      tipAmount: tip,
      netAmount: gross,
      tenderType: 'CARD',
      lineItems,
      raw: order,
    };
  }
}
