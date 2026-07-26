/**
 * Square POS ↔ Stripe marketplace inventory sync unit tests.
 * Covers inbound Square webhooks and outbound Stripe→Square deductions.
 */

import type { ConfigService } from '@nestjs/config';

import { SquareIntegrationService } from '../src/modules/pos/services/square-integration.service';
import type { PosConnectionService } from '../src/modules/pos/services/pos-connection.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsGatewayService } from '../src/modules/stripe/payments-gateway.service';
import type { PaymentClearingService } from '../src/modules/financial/payment-clearing.service';
import type { StripeService } from '../src/modules/stripe/stripe.service';

const VENDOR_ID = '11111111-1111-1111-1111-111111111111';
const SKU = 'SKU-SOURDOUGH';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    SQUARE_ENVIRONMENT: 'sandbox',
    PUBLIC_BASE_URL: 'https://api.test',
    WEB_APP_URL: 'https://app.test',
    ...overrides,
  };
  return {
    get: (key: string, def?: string) =>
      key in values ? values[key] : def,
  } as unknown as ConfigService;
}

function buildSquareService(opts?: {
  stockAfter?: number;
  merchantVendorId?: string | null;
}) {
  const stockAfter = opts?.stockAfter ?? 7;
  const executeRawResults: unknown[] = [];
  const prisma = {
    posConnection: {
      findFirst: jest.fn(async () =>
        opts?.merchantVendorId === null
          ? null
          : {
              id: 'conn-1',
              vendorId: opts?.merchantVendorId ?? VENDOR_ID,
              providerLocationId: 'L1',
            },
      ),
    },
    posProductMapping: {
      findFirst: jest.fn(async () => ({
        providerCatalogObjectId: 'CATALOG_SOURDOUGH',
      })),
    },
    $queryRaw: jest.fn(async () => [{ stock: stockAfter }]),
    $executeRaw: jest.fn(async () => 1),
  } as unknown as PrismaService;

  const connections = {
    getUsableCredentials: jest.fn(async () => ({
      accessToken: '',
    })),
  } as unknown as PosConnectionService;

  const service = new SquareIntegrationService(
    fakeConfig(),
    prisma,
    connections,
  );

  return { service, prisma, connections, executeRawResults };
}

describe('SquareIntegrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deductSquareInventory mocks when live Square credentials are absent', async () => {
    const { service } = buildSquareService({ stockAfter: 4 });
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

    const result = await service.deductSquareInventory(VENDOR_ID, SKU, 2);

    expect(result.STATUS).toBe('SQUARE_DEDUCT_MOCK');
    expect(result.MODE).toBe('MOCK');
    expect(result.QUANTITY).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('INVENTORY_SYNCED'),
    );
  });

  it('handles inventory.count.updated webhook and logs INVENTORY_SYNCED', async () => {
    const { service } = buildSquareService({ stockAfter: 9 });
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

    const payload = {
      type: 'inventory.count.updated',
      merchant_id: 'MERCHANT_1',
      event_id: 'evt_inv_1',
      data: {
        object: {
          inventory_counts: [
            {
              catalog_object_id: SKU,
              quantity: '9',
              quantity_sold: 1,
              location_id: 'L1',
            },
          ],
        },
      },
    };

    const result = await service.handleInboundWebhook(
      Buffer.from(JSON.stringify(payload)),
      {},
    );

    expect(result.STATUS).toBe('INVENTORY_SYNCED');
    expect(result.EVENT_TYPE).toBe('inventory.count.updated');
    expect(result.ITEMS[0]).toMatchObject({ SKU, QUANTITY: 1, STOCK_AFTER: 9 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^INVENTORY_SYNCED /),
    );
  });

  it('handles order.created webhook line items', async () => {
    const { service } = buildSquareService({ stockAfter: 3 });

    const payload = {
      type: 'order.created',
      merchant_id: 'MERCHANT_1',
      data: {
        object: {
          order: {
            line_items: [
              {
                catalog_object_id: SKU,
                quantity: '2',
                name: 'Sourdough',
              },
            ],
          },
        },
      },
    };

    const result = await service.handleInboundWebhook(
      JSON.stringify(payload),
      {},
    );

    expect(result.STATUS).toBe('INVENTORY_SYNCED');
    expect(result.ITEMS).toEqual([
      expect.objectContaining({ SKU, QUANTITY: 2, STOCK_AFTER: 3 }),
    ]);
  });
});

describe('Stripe checkout → Square deduct (before HELD_IN_ESCROW)', () => {
  it('calls deductSquareInventory before holdInEscrow on checkout.session.completed', async () => {
    const deductSquareInventory = jest.fn(async () => ({
      STATUS: 'SQUARE_DEDUCT_MOCK' as const,
      VENDOR_ID,
      SKU,
      QUANTITY: 1,
      MODE: 'MOCK' as const,
    }));
    const extractCheckoutDeductionLines = jest.fn(() => [
      { vendorId: VENDOR_ID, sku: SKU, quantity: 1 },
    ]);
    const holdInEscrow = jest.fn(async () => ({
      STATUS: 'ESCROW_LEDGER_ACTIVE',
      TRANSACTION_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    }));
    const callOrder: string[] = [];
    deductSquareInventory.mockImplementation(async () => {
      callOrder.push('DEDUCT');
      return {
        STATUS: 'SQUARE_DEDUCT_MOCK' as const,
        VENDOR_ID,
        SKU,
        QUANTITY: 1,
        MODE: 'MOCK' as const,
      };
    });
    holdInEscrow.mockImplementation(async () => {
      callOrder.push('ESCROW');
      return {
        STATUS: 'ESCROW_LEDGER_ACTIVE',
        TRANSACTION_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      };
    });

    const square = {
      deductSquareInventory,
      extractCheckoutDeductionLines,
    } as unknown as SquareIntegrationService;

    const clearing = { holdInEscrow } as unknown as PaymentClearingService;
    const stripe = {
      verifyWebhook: jest.fn(() => ({
        id: 'evt_square_sync',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test',
            payment_intent: 'pi_test',
            amount_total: 1800,
            metadata: {
              reference_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              purpose: 'ESCROW_HOLD',
              amount_cents: '1800',
              vendor_id: VENDOR_ID,
              sku: SKU,
              quantity: '1',
            },
          },
        },
      })),
      requireClient: jest.fn(),
    } as unknown as StripeService;

    const prisma = {
      $queryRaw: jest.fn(async () => []),
      $executeRaw: jest.fn(async () => 1),
    } as unknown as PrismaService;

    const gateway = new PaymentsGatewayService(
      fakeConfig(),
      prisma,
      stripe,
      clearing,
      square,
    );

    await gateway.handleWebhook(Buffer.from('{}'), 'sig_ok');

    expect(deductSquareInventory).toHaveBeenCalledWith(VENDOR_ID, SKU, 1);
    expect(holdInEscrow).toHaveBeenCalled();
    expect(callOrder).toEqual(['DEDUCT', 'ESCROW']);
  });
});
