/**
 * Resolves provider location → market_id for snapshot rollup scoping.
 */

import { Injectable, Logger } from '@nestjs/common';

import type { LedgerProvider, ResolvedMarketContext, ResolvedPosConnection } from '../types/ledger-transaction';

@Injectable()
export class PosMarketResolverService {
  private readonly logger = new Logger(PosMarketResolverService.name);

  async resolveConnection(
    provider: LedgerProvider,
    merchantId?: string,
    locationId?: string,
  ): Promise<ResolvedPosConnection | null> {
    // TODO: query vendor_pos_connections by provider + merchant/location
    this.logger.debug(
      `resolveConnection scaffold: ${provider} merchant=${merchantId} location=${locationId}`,
    );
    return null;
  }

  async resolveMarketForVendor(
    vendorId: string,
    providerLocationId?: string,
  ): Promise<ResolvedMarketContext | null> {
    // TODO: vendor_market_registrations + optional location mapping
    this.logger.debug(
      `resolveMarketForVendor scaffold: vendor=${vendorId} location=${providerLocationId}`,
    );
    void vendorId;
    void providerLocationId;
    return null;
  }
}
