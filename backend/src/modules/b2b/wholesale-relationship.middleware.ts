import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { VendorPeerRequestsService } from './vendor-peer-requests.service';
import {
  isPeerRelationshipBlocked,
  resolveWholesalePricingMode,
  type WholesalePricingMode,
} from './wholesale-relationship.util';

export type { WholesalePricingMode };

export type RequestWithWholesalePricing = Request & {
  wholesalePricingMode?: WholesalePricingMode;
  wholesalePeerConnectionId?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks vendor_peer_connections for the buyer/seller pair on wholesale drafts.
 * ACCEPTED relationships flag the transaction for TIERED_WHOLESALE_PRICING.
 * sale_mode=RETAIL bypasses peer status entirely (RETAIL_SALE).
 */
@Injectable()
export class WholesaleRelationshipMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WholesaleRelationshipMiddleware.name);

  constructor(private readonly peerRequests: VendorPeerRequestsService) {}

  async use(
    req: RequestWithWholesalePricing,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const saleModeRaw =
        typeof body.sale_mode === 'string' ? body.sale_mode.trim().toUpperCase() : '';
      if (saleModeRaw === 'RETAIL') {
        req.wholesalePricingMode = 'RETAIL_SALE';
        req.wholesalePeerConnectionId = null;
        this.logger.log('RETAIL_SALE_MODE_ENABLED');
        next();
        return;
      }

      const buyerVendorId =
        typeof body.buyer_vendor_id === 'string' ? body.buyer_vendor_id.trim() : '';
      const sellerVendorId =
        typeof body.seller_vendor_id === 'string'
          ? body.seller_vendor_id.trim()
          : '';

      if (!buyerVendorId || !sellerVendorId) {
        req.wholesalePricingMode = 'STANDARD';
        req.wholesalePeerConnectionId = null;
        next();
        return;
      }

      if (!UUID_RE.test(buyerVendorId) || !UUID_RE.test(sellerVendorId)) {
        next(
          new BadRequestException(
            'PEER_VALIDATION_ERROR: BUYER_SELLER_VENDOR_ID INVALID',
          ),
        );
        return;
      }

      const peer = await this.peerRequests.findBetween(
        buyerVendorId,
        sellerVendorId,
      );
      const status = peer?.status ?? null;

      if (isPeerRelationshipBlocked(status)) {
        this.logger.warn(
          `TIERED_WHOLESALE_PRICING BLOCKED BUYER=${buyerVendorId} SELLER=${sellerVendorId} REQUEST=${peer?.id ?? 'NONE'}`,
        );
        next(new ForbiddenException('PEER_ERROR: CONNECTION_BLOCKED'));
        return;
      }

      const mode = resolveWholesalePricingMode(status);
      req.wholesalePricingMode = mode;
      req.wholesalePeerConnectionId = peer?.id ?? null;

      if (mode === 'TIERED_WHOLESALE_PRICING') {
        this.logger.log(
          `TIERED_WHOLESALE_PRICING ENABLED=1 BUYER=${buyerVendorId} SELLER=${sellerVendorId} REQUEST=${peer?.id ?? 'NONE'}`,
        );
      } else {
        this.logger.log(
          `TIERED_WHOLESALE_PRICING ENABLED=0 BUYER=${buyerVendorId} SELLER=${sellerVendorId} STATUS=${status ?? 'ABSENT'}`,
        );
      }

      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
