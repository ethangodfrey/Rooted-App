/**
 * Resolves vendor_pos_connections and market context for sales ingest workers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  LedgerProvider,
  ResolvedMarketContext,
  ResolvedPosConnection,
} from '../types/ledger-transaction';

interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

@Injectable()
export class PosMarketResolverService {
  private readonly logger = new Logger(PosMarketResolverService.name);

  constructor(private readonly config: ConfigService) {}

  private adminConfig(): SupabaseAdminConfig | null {
    const url = this.config.get<string>('SUPABASE_URL', '').trim();
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '').trim();
    if (!url || !serviceKey) return null;
    return { url: url.replace(/\/$/, ''), serviceKey };
  }

  private async restGet<T>(path: string): Promise<T[]> {
    const admin = this.adminConfig();
    if (!admin) return [];

    const res = await fetch(`${admin.url}/rest/v1/${path}`, {
      headers: {
        apikey: admin.serviceKey,
        Authorization: `Bearer ${admin.serviceKey}`,
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.warn(`Supabase GET failed: ${detail.slice(0, 200)}`);
      return [];
    }

    return (await res.json()) as T[];
  }

  async resolveConnection(
    provider: LedgerProvider,
    merchantId?: string,
    locationId?: string,
  ): Promise<ResolvedPosConnection | null> {
    const params = new URLSearchParams({
      provider: `eq.${provider}`,
      status: 'eq.active',
      select:
        'id,vendor_id,user_id,tenant_id,provider,provider_merchant_id,provider_location_id,status',
      limit: '5',
    });

    if (merchantId) {
      params.set('provider_merchant_id', `eq.${merchantId}`);
    }
    if (locationId) {
      params.set('provider_location_id', `eq.${locationId}`);
    }

    const rows = await this.restGet<{
      id: string;
      vendor_id: string;
      user_id: string;
      tenant_id: string | null;
      provider: LedgerProvider;
      provider_merchant_id: string | null;
      provider_location_id: string | null;
      status: string;
    }>(`vendor_pos_connections?${params.toString()}`);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      vendorId: row.vendor_id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      provider: row.provider,
      providerMerchantId: row.provider_merchant_id,
      providerLocationId: row.provider_location_id,
      status: row.status,
    };
  }

  async resolveMarketForVendor(
    vendorId: string,
    _providerLocationId?: string,
  ): Promise<ResolvedMarketContext | null> {
    const params = new URLSearchParams({
      vendor_id: `eq.${vendorId}`,
      registration_status: 'eq.approved',
      select: 'market_id,vendor_id',
      limit: '1',
    });

    const rows = await this.restGet<{ market_id: string; vendor_id: string }>(
      `vendor_market_registrations?${params.toString()}`,
    );

    const row = rows[0];
    if (!row) return null;

    return {
      marketId: row.market_id,
      vendorId: row.vendor_id,
    };
  }
}
