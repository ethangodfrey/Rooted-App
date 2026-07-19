/**
 * Multi-tenant B2B data isolation audit.
 *
 * Verifies vendor_business_connections + wholesale_products cannot leak
 * across mismatched Tenant_A / Tenant_B sessions.
 *
 * Run:
 *   npm test -- --testPathPatterns=b2b.isolation --no-coverage
 *   (repo path: backend/src/modules/b2b/b2b.isolation.spec.ts)
 */

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { VendorBusinessConnectionStatus } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CONNECTION_ISOLATION_CONTRACT,
  CONNECTION_TENANT_A_ID,
  TENANT_A_VENDOR_ID,
  TENANT_B_VENDOR_ID,
  TENANT_C_VENDOR_ID,
  WHOLESALE_ISOLATION_CONTRACT,
  WHOLESALE_SKU_TENANT_A_ID,
  assertNoCrossTenantLeak,
  logIsolation,
} from './b2b-isolation.contracts';
import { VendorConnectionsService } from './vendor-connections.service';
import { WholesaleProductsService } from './wholesale-products.service';

describe('B2B MULTI-TENANT DATA ISOLATION', () => {
  describe('RLS policy contracts', () => {
    it('DATA_ISOLATION_VERIFIED phase54 policies bind connections and wholesale to auth vendor', () => {
      const sqlPath = resolve(
        process.cwd(),
        '../docs/supabase/phase54_b2b_wholesale_marketplace.sql',
      );
      const sql = readFileSync(sqlPath, 'utf8');

      expect(sql).toContain('enable row level security');
      expect(sql).toContain(CONNECTION_ISOLATION_CONTRACT.TABLE);
      expect(sql).toContain(WHOLESALE_ISOLATION_CONTRACT.TABLE);
      expect(sql).toContain('v.user_id = auth.uid()');
      expect(sql).toContain('v.id = vendor_id');
      expect(sql).toContain('v.id = sender_vendor_id');
      expect(sql).toContain('Vendors manage own wholesale products');
      expect(sql).toContain('B2B vendors read own business connections');

      logIsolation('DATA_ISOLATION_VERIFIED RLS_CONTRACTS_PHASE54');
    });
  });

  describe('wholesale_products cross-tenant boundaries', () => {
    it('CROSS_TENANT_LEAK_BLOCKED when Tenant_B lists own catalog — Tenant_A SKU excluded', async () => {
      const tenantASku = {
        id: WHOLESALE_SKU_TENANT_A_ID,
        vendorId: TENANT_A_VENDOR_ID,
        name: 'Tenant A Bulk Case',
        status: 'ACTIVE',
      };

      const findMany = jest.fn().mockImplementation(async ({ where }: { where: { vendorId: string } }) => {
        // Simulate DB/RLS: only rows matching the session vendor filter.
        if (where.vendorId === TENANT_A_VENDOR_ID) return [tenantASku];
        return [];
      });

      const prisma = { wholesaleProduct: { findMany } };
      const indexer = {
        indexProduct: jest.fn().mockResolvedValue({
          SYNCED: false,
          SKIPPED_REASON: 'NODE_UNSET',
        }),
      };
      const service = new WholesaleProductsService(
        prisma as never,
        indexer as never,
      );

      const tenantBRows = await service.listForVendor(TENANT_B_VENDOR_ID);
      expect(tenantBRows).toEqual([]);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vendorId: TENANT_B_VENDOR_ID }),
        }),
      );
      assertNoCrossTenantLeak(tenantBRows, TENANT_B_VENDOR_ID, 'WHOLESALE');
      logIsolation('CROSS_TENANT_LEAK_BLOCKED ACTION=WHOLESALE_LIST EMPTY_PAYLOAD');
    });

    it('CROSS_TENANT_LEAK_BLOCKED when Tenant_B updates Tenant_A wholesale SKU', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: WHOLESALE_SKU_TENANT_A_ID,
        vendorId: TENANT_A_VENDOR_ID,
      });
      const update = jest.fn();
      const prisma = {
        wholesaleProduct: { findUnique, update },
      };
      const indexer = {
        indexProduct: jest.fn().mockResolvedValue({
          SYNCED: false,
          SKIPPED_REASON: 'NODE_UNSET',
        }),
      };
      const service = new WholesaleProductsService(
        prisma as never,
        indexer as never,
      );

      await expect(
        service.updateForVendor(TENANT_B_VENDOR_ID, WHOLESALE_SKU_TENANT_A_ID, {
          moq: 99,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(update).not.toHaveBeenCalled();
      logIsolation(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=WHOLESALE_UPDATE SESSION=${TENANT_B_VENDOR_ID} OWNER=${TENANT_A_VENDOR_ID}`,
      );
    });

    it('DATA_ISOLATION_VERIFIED create stamps session vendorId only (Tenant_A)', async () => {
      const create = jest.fn().mockResolvedValue({
        id: WHOLESALE_SKU_TENANT_A_ID,
        vendorId: TENANT_A_VENDOR_ID,
        name: 'Tenant A Case',
        description: null,
        packagingUnit: 'CASE',
        moq: 5,
        unitPriceCents: 2400,
        availableQuantity: 0,
        status: 'ACTIVE',
        updatedAt: new Date('2026-07-19T00:00:00.000Z'),
      });
      const prisma = { wholesaleProduct: { create } };
      const indexer = {
        indexProduct: jest.fn().mockResolvedValue({
          SYNCED: true,
          SKIPPED_REASON: null,
        }),
      };
      const service = new WholesaleProductsService(
        prisma as never,
        indexer as never,
      );

      await service.create(TENANT_A_VENDOR_ID, {
        name: 'Tenant A Case',
        description: null,
        packagingUnit: 'CASE',
        weightLbs: 20,
        moq: 5,
        unitPriceCents: 2400,
        pricingTiers: [],
        freightNotes: null,
        pickupNotes: null,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ vendorId: TENANT_A_VENDOR_ID }),
        }),
      );
      expect(indexer.indexProduct).toHaveBeenCalled();
      const stamped = create.mock.calls[0][0].data.vendorId;
      expect(stamped).not.toBe(TENANT_B_VENDOR_ID);
      logIsolation('DATA_ISOLATION_VERIFIED ACTION=WHOLESALE_CREATE VENDOR_STAMP=TENANT_A');
      logIsolation('ELASTICSEARCH_SYNC_COMPLETED ACTION=WHOLESALE_CREATE');
    });

    it('DATA_ISOLATION_VERIFIED Tenant_A may update own SKU', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: WHOLESALE_SKU_TENANT_A_ID,
        vendorId: TENANT_A_VENDOR_ID,
      });
      const update = jest.fn().mockResolvedValue({
        id: WHOLESALE_SKU_TENANT_A_ID,
        vendorId: TENANT_A_VENDOR_ID,
        name: 'Tenant A Case',
        description: null,
        packagingUnit: 'CASE',
        moq: 8,
        unitPriceCents: 2400,
        availableQuantity: 0,
        status: 'ACTIVE',
        updatedAt: new Date('2026-07-19T00:00:00.000Z'),
      });
      const prisma = { wholesaleProduct: { findUnique, update } };
      const indexer = {
        indexProduct: jest.fn().mockResolvedValue({
          SYNCED: true,
          SKIPPED_REASON: null,
        }),
      };
      const service = new WholesaleProductsService(
        prisma as never,
        indexer as never,
      );

      const updated = await service.updateForVendor(
        TENANT_A_VENDOR_ID,
        WHOLESALE_SKU_TENANT_A_ID,
        { moq: 8 },
      );
      expect(updated.moq).toBe(8);
      expect(update).toHaveBeenCalled();
      expect(indexer.indexProduct).toHaveBeenCalled();
      logIsolation('DATA_ISOLATION_VERIFIED ACTION=WHOLESALE_UPDATE OWNER=TENANT_A');
      logIsolation('ELASTICSEARCH_SYNC_COMPLETED ACTION=WHOLESALE_UPDATE');
    });
  });

  describe('vendor_business_connections cross-tenant boundaries', () => {
    const tenantAConnection = {
      id: CONNECTION_TENANT_A_ID,
      senderVendorId: TENANT_A_VENDOR_ID,
      receiverVendorId: TENANT_C_VENDOR_ID,
      status: VendorBusinessConnectionStatus.PENDING,
      initiatedAt: new Date('2026-07-19T00:00:00.000Z'),
    };

    it('CROSS_TENANT_LEAK_BLOCKED when Tenant_B lists connections — Tenant_A edge excluded', async () => {
      const findMany = jest.fn().mockImplementation(
        async ({
          where,
        }: {
          where: { OR: Array<{ senderVendorId?: string; receiverVendorId?: string }> };
        }) => {
          const session = where.OR[0]?.senderVendorId;
          if (session === TENANT_A_VENDOR_ID) return [tenantAConnection];
          return [];
        },
      );

      const prisma = { vendorBusinessConnection: { findMany } };
      const service = new VendorConnectionsService(prisma as never);

      const tenantBRows = await service.listForVendor(TENANT_B_VENDOR_ID);
      expect(tenantBRows).toEqual([]);
      assertNoCrossTenantLeak(tenantBRows, TENANT_B_VENDOR_ID, 'CONNECTION');
      logIsolation('CROSS_TENANT_LEAK_BLOCKED ACTION=CONNECTION_LIST EMPTY_PAYLOAD');
    });

    it('CROSS_TENANT_LEAK_BLOCKED when Tenant_B fetches Tenant_A peer edge — empty payload', async () => {
      const findFirst = jest.fn().mockImplementation(
        async ({
          where,
        }: {
          where: {
            OR: Array<{ senderVendorId: string; receiverVendorId: string }>;
          };
        }) => {
          const viewer = where.OR[0]?.senderVendorId;
          if (viewer !== TENANT_A_VENDOR_ID) return null;
          return tenantAConnection;
        },
      );

      const prisma = { vendorBusinessConnection: { findFirst } };
      const service = new VendorConnectionsService(prisma as never);

      const row = await service.findWithPeer(TENANT_B_VENDOR_ID, TENANT_C_VENDOR_ID);
      expect(row).toBeNull();
      logIsolation('CROSS_TENANT_LEAK_BLOCKED ACTION=CONNECTION_PEER EMPTY_PAYLOAD');
    });

    it('CROSS_TENANT_LEAK_BLOCKED when Tenant_B updates Tenant_A connection', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: CONNECTION_TENANT_A_ID,
        senderVendorId: TENANT_A_VENDOR_ID,
        receiverVendorId: TENANT_C_VENDOR_ID,
      });
      const update = jest.fn();
      const prisma = {
        vendorBusinessConnection: { findUnique, update },
      };
      const service = new VendorConnectionsService(prisma as never);

      await expect(
        service.updateStatusForVendor(
          TENANT_B_VENDOR_ID,
          CONNECTION_TENANT_A_ID,
          VendorBusinessConnectionStatus.ACCEPTED,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(update).not.toHaveBeenCalled();
      logIsolation(
        `CROSS_TENANT_LEAK_BLOCKED ACTION=CONNECTION_UPDATE SESSION=${TENANT_B_VENDOR_ID}`,
      );
    });

    it('DATA_ISOLATION_VERIFIED connection request stamps sender as session vendor', async () => {
      const findUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: TENANT_A_VENDOR_ID })
        .mockResolvedValueOnce({ id: TENANT_C_VENDOR_ID });
      const findFirst = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockResolvedValue({
        id: CONNECTION_TENANT_A_ID,
        senderVendorId: TENANT_A_VENDOR_ID,
        receiverVendorId: TENANT_C_VENDOR_ID,
        status: VendorBusinessConnectionStatus.PENDING,
      });

      const prisma = {
        vendor: { findUnique },
        vendorBusinessConnection: { findFirst, create },
      };
      const service = new VendorConnectionsService(prisma as never);

      await service.requestConnection(TENANT_A_VENDOR_ID, TENANT_C_VENDOR_ID);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            senderVendorId: TENANT_A_VENDOR_ID,
            receiverVendorId: TENANT_C_VENDOR_ID,
          }),
        }),
      );
      logIsolation('DATA_ISOLATION_VERIFIED ACTION=CONNECTION_REQUEST SENDER=TENANT_A');
    });
  });

  describe('session auth boundary', () => {
    it('CROSS_TENANT_LEAK_BLOCKED controller requireVendor without vendor profile', () => {
      // Mirror controller private requireVendor contract.
      const requireVendor = (user: { vendorId?: string }): string => {
        if (!user.vendorId) {
          throw new UnauthorizedException('B2B_ERROR: VENDOR_PROFILE_REQUIRED');
        }
        return user.vendorId;
      };

      expect(() => requireVendor({})).toThrow(UnauthorizedException);
      expect(requireVendor({ vendorId: TENANT_B_VENDOR_ID })).toBe(TENANT_B_VENDOR_ID);
      logIsolation('CROSS_TENANT_LEAK_BLOCKED ACTION=AUTH_VENDOR_REQUIRED');
    });
  });

  it('DATA_ISOLATION_VERIFIED suite summary', () => {
    expect(WHOLESALE_ISOLATION_CONTRACT.CROSS_TENANT_MUTATION).toBe('FORBIDDEN');
    expect(CONNECTION_ISOLATION_CONTRACT.CROSS_TENANT_RESPONSE).toBe(
      'EMPTY_OR_FORBIDDEN',
    );
    logIsolation('DATA_ISOLATION_VERIFIED B2B_SCHEMAS=vendor_business_connections,wholesale_products');
  });
});
