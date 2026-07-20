/**
 * Platform golden-path E2E smoke test.
 *
 * Journey: Discovery → Stripe checkout webhook → Escrow → Logistics →
 * Fulfillment → Settlement + Telemetry.
 *
 * Telemetry (uppercase, no emoji):
 *   E2E_TEST_INITIALIZED
 *   PLATFORM_LIFECYCLE_VERIFIED
 */

import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { B2bMarketplaceService } from '../src/modules/b2b/b2b-marketplace.service';
import { PaymentClearingService } from '../src/modules/financial/payment-clearing.service';
import { LogisticsFulfillmentService } from '../src/modules/logistics/logistics-fulfillment.service';
import type { RedemptionService } from '../src/modules/loyalty/redemption.service';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { createFakePlatformPrisma } from './fake-platform-prisma';

const FARMER_USER_ID = '11111111-1111-4111-8111-111111111111';
const VENDOR_USER_ID = '22222222-2222-4222-8222-222222222222';
const FARMER_ID = '33333333-3333-4333-8333-333333333333';
const VENDOR_ID = '44444444-4444-4444-8444-444444444444';
const LISTING_ID = '55555555-5555-4555-8555-555555555555';

const QUANTITY = 10;
const BULK_UNIT_PRICE = 15.5; // dollars → 1550 cents/unit
const EXPECTED_AMOUNT_CENTS = QUANTITY * Math.round(BULK_UNIT_PRICE * 100);

function log(message: string): void {
  // Clean uppercase monospaced lifecycle logs (no emoji).
  // eslint-disable-next-line no-console
  console.log(message);
}

/** Mirrors PaymentsGatewayService.onCheckoutSessionCompleted after Stripe mock. */
async function simulateStripeCheckoutCompleted(
  clearing: PaymentClearingService,
  referenceId: string,
  amountCents: number,
  stampMetadata: (transactionId: string) => Promise<void>,
) {
  log('PAYMENT_WEBHOOKS_ACTIVE EVENT=checkout.session.completed');
  const escrow = await clearing.holdInEscrow(referenceId, amountCents);
  const transactionId =
    escrow &&
    typeof escrow === 'object' &&
    'TRANSACTION_ID' in escrow &&
    typeof (escrow as { TRANSACTION_ID?: string }).TRANSACTION_ID === 'string'
      ? (escrow as { TRANSACTION_ID: string }).TRANSACTION_ID
      : null;
  if (transactionId) {
    await stampMetadata(transactionId);
  }
  return escrow;
}

describe('Platform E2E golden path', () => {
  it('runs Discovery → Escrow → Logistics → Fulfillment → Settlement', async () => {
    log('E2E_TEST_INITIALIZED');

    const { prisma, store } = createFakePlatformPrisma({
      users: [
        {
          id: FARMER_USER_ID,
          email: 'farmer.e2e@vendorly.test',
          phone: '+15551110001',
          notification_preferences: { emailEnabled: true, smsEnabled: true },
        },
        {
          id: VENDOR_USER_ID,
          email: 'vendor.e2e@vendorly.test',
          phone: '+15552220002',
          notification_preferences: { emailEnabled: true, smsEnabled: true },
        },
      ],
      farmers: [
        {
          id: FARMER_ID,
          user_id: FARMER_USER_ID,
          farm_name: 'E2E Test Farm',
          stripe_account_id: 'acct_test_farmer_e2e',
          is_wholesale_supplier: true,
        },
      ],
      vendors: [
        {
          id: VENDOR_ID,
          user_id: VENDOR_USER_ID,
          business_name: 'E2E Test Vendor',
          stripe_account_id: 'acct_test_vendor_e2e',
          is_wholesale_provider: true,
        },
      ],
      wholesale_listings: [
        {
          id: LISTING_ID,
          producer_id: FARMER_ID,
          producer_type: 'FARMER',
          item_name: 'Heirloom Tomatoes Bulk',
          bulk_unit_price: BULK_UNIT_PRICE,
          min_order_quantity: 5,
          availability_status: 'AVAILABLE',
        },
      ],
      farmer_balances: [
        {
          farmer_id: FARMER_ID,
          available_cents: 0,
          escrow_held_cents: 0,
          updated_at: new Date(),
        },
      ],
    });

    const redemption = {
      resolveActiveVoucherCents: jest.fn(async () => ({
        voucherCents: 0,
        redemptionId: null,
      })),
      markVoucherUsed: jest.fn(async () => undefined),
    } as unknown as RedemptionService;

    const notifications = new NotificationService(prisma);
    const clearing = new PaymentClearingService(prisma, redemption, notifications);
    const logistics = new LogisticsFulfillmentService(prisma, clearing, notifications);
    const b2b = new B2bMarketplaceService(prisma);

    const pendingNotifications: Promise<void>[] = [];
    jest.spyOn(notifications, 'dispatchSafe').mockImplementation((task) => {
      pendingNotifications.push(
        Promise.resolve(task).catch(() => {
          /* non-blocking */
        }),
      );
    });

    // --- Discovery: vendor posts procurement; farmer accepts ---
    const posted = await b2b.createProcurement(VENDOR_ID, {
      farmerId: FARMER_ID,
      listingId: LISTING_ID,
      requestedQuantity: QUANTITY,
      message: 'E2E bulk tomatoes',
    });
    expect(posted.ACTION).toBe('PROCUREMENT_REQUESTED');
    expect(posted.REQUEST_STATUS).toBe('PENDING');
    const procurementId = posted.REQUEST_ID as string;
    expect(procurementId).toBeTruthy();

    const accepted = await b2b.updateProcurementStatus({
      requestId: procurementId,
      statusRaw: 'ACCEPTED',
      actor: { role: 'farmer', farmerId: FARMER_ID, vendorId: null },
    });
    expect(accepted.REQUEST_STATUS).toBe('ACCEPTED');
    log(`E2E_TEST_INITIALIZED ACTION=PROCUREMENT_ACCEPTED ID=${procurementId}`);

    // --- Checkout & Escrow: mocked Stripe checkout.session.completed ---
    const stripeSessionId = `cs_test_${randomUUID().slice(0, 8)}`;
    const paymentIntentId = `pi_test_${randomUUID().slice(0, 8)}`;
    const escrow = await simulateStripeCheckoutCompleted(
      clearing,
      procurementId,
      EXPECTED_AMOUNT_CENTS,
      async (transactionId) => {
        await prisma.$executeRaw(Prisma.sql`
          UPDATE public.financial_transactions
          SET
            metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
              stripe_payment_intent_id: paymentIntentId,
              stripe_checkout_session_id: stripeSessionId,
            })}::jsonb,
            updated_at = NOW()
          WHERE id = ${transactionId}::uuid
        `);
      },
    );

    expect(escrow.ACTION).toBe('HELD_IN_ESCROW');
    expect(escrow.ALREADY_HELD).toBe(false);
    const txId = (escrow as { TRANSACTION_ID: string }).TRANSACTION_ID;
    const heldTx = store.financial_transactions.find((t) => t.id === txId);
    expect(heldTx?.status).toBe('HELD_IN_ESCROW');
    expect(Number(heldTx?.net_amount_cents)).toBe(EXPECTED_AMOUNT_CENTS);
    const farmerAfterHold = store.farmer_balances.find((b) => b.farmer_id === FARMER_ID);
    expect(Number(farmerAfterHold?.escrow_held_cents)).toBe(EXPECTED_AMOUNT_CENTS);
    log(`ESCROW_LEDGER_ACTIVE ACTION=HELD_IN_ESCROW TX=${txId}`);

    // --- Logistics: farmer creates delivery_route + delivery_stop ---
    const route = await logistics.createRouteFromAcceptedOrders({
      farmerId: FARMER_ID,
      procurementRequestIds: [procurementId],
      dispatchDate: '2026-07-21',
    });
    expect(route.ACTION).toBe('ROUTE_CREATED');
    expect(route.COUNT).toBe(1);
    expect(route.STOPS[0].status).toBe('PENDING');
    const stopId = route.STOPS[0].id;
    log(`FLEET_TRACKING_ACTIVE ACTION=ROUTE_CREATED ROUTE=${route.ROUTE_ID}`);

    // --- Fulfillment: confirmDropoff → DELIVERED ---
    const dropoff = await logistics.confirmDropoff(stopId);
    expect(dropoff.STOP_STATUS).toBe('DELIVERED');
    expect(dropoff.ACTION).toBe('DROPOFF_CONFIRMED');
    const stop = store.delivery_stops.find((s) => s.id === stopId);
    expect(stop?.status).toBe('DELIVERED');

    // Flush non-blocking notification side-effects
    await Promise.all(pendingNotifications);

    // --- Settlement & Telemetry ---
    const settledTx = store.financial_transactions.find((t) => t.id === txId);
    expect(settledTx?.status).toBe('SETTLED');

    const farmerSettled = store.farmer_balances.find((b) => b.farmer_id === FARMER_ID);
    expect(Number(farmerSettled?.available_cents)).toBe(EXPECTED_AMOUNT_CENTS);
    expect(Number(farmerSettled?.escrow_held_cents)).toBe(0);

    expect(store.notifications_log.length).toBeGreaterThanOrEqual(1);
    const escrowNotify = store.notifications_log.find(
      (n) => n.event_type === 'ESCROW_SETTLED',
    );
    const deliveryNotify = store.notifications_log.find(
      (n) => n.event_type === 'DELIVERY_STOP_DELIVERED',
    );
    expect(escrowNotify || deliveryNotify).toBeTruthy();

    log('PLATFORM_LIFECYCLE_VERIFIED');
  });
});
