import type { PrismaService } from '../src/prisma/prisma.service';

export interface FakeOrderRow {
  id: string;
  total: number;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  vendor_id: string;
  business_name: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  customer_user_id: string;
}

export interface FakeOrderPrisma {
  prisma: PrismaService;
  orders: FakeOrderRow[];
}

/** In-memory Prisma double for Stripe checkout + webhook order mutations. */
export function createFakeOrderPrisma(seed?: FakeOrderRow[]): FakeOrderPrisma {
  const orders: FakeOrderRow[] = (seed ?? []).map((o) => ({ ...o }));

  const findOrder = (orderId: string, customerUserId: string): FakeOrderRow | undefined =>
    orders.find((o) => o.id === orderId && o.customer_user_id === customerUserId);

  const prisma = {
    $queryRaw: jest.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const [orderId, customerUserId] = values as [string, string];
      const row = findOrder(orderId, customerUserId);
      if (!row) return [];
      return [
        {
          id: row.id,
          total: row.total,
          payment_status: row.payment_status,
          stripe_checkout_session_id: row.stripe_checkout_session_id,
          vendor_id: row.vendor_id,
          business_name: row.business_name,
          stripe_account_id: row.stripe_account_id,
          stripe_charges_enabled: row.stripe_charges_enabled,
        },
      ];
    }),

    $executeRaw: jest.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = _strings.join(' ');

      if (sql.includes("payment_status = 'stripe_pending'")) {
        const [sessionId, orderId] = values as [string, string];
        const row = orders.find((o) => o.id === orderId);
        if (row) {
          row.stripe_checkout_session_id = sessionId;
          row.payment_status = 'stripe_pending';
        }
        return 1;
      }

      if (sql.includes("payment_status = 'paid_online'")) {
        const [paymentIntentId, orderId, sessionId] = values as [
          string | null,
          string,
          string,
        ];
        const row = orders.find(
          (o) => o.id === orderId && o.stripe_checkout_session_id === sessionId,
        );
        if (row) {
          row.payment_status = 'paid_online';
          row.stripe_payment_intent_id = paymentIntentId;
        }
        return row ? 1 : 0;
      }

      return 0;
    }),

    vendor: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  return { prisma: prisma as unknown as PrismaService, orders };
}
