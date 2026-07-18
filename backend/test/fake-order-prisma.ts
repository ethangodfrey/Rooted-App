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
  platform_fee?: number;
  transaction_id?: string | null;
}

export interface FakeOrderPrisma {
  prisma: PrismaService;
  orders: FakeOrderRow[];
}

function createTxClient(orders: FakeOrderRow[]) {
  const findOrder = (orderId: string, customerUserId?: string): FakeOrderRow | undefined =>
    orders.find(
      (o) =>
        o.id === orderId &&
        (customerUserId == null || o.customer_user_id === customerUserId),
    );

  return {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ');

      if (sql.includes("payment_status = 'paid_online'") && sql.includes('update public.orders')) {
        const paymentIntentId = values[0] as string | null;
        const orderId = values[1] as string;
        const sessionId = values[2] as string;
        const row = orders.find(
          (o) =>
            o.id === orderId &&
            o.stripe_checkout_session_id === sessionId &&
            o.payment_status === 'stripe_pending',
        );
        if (!row) return [];
        row.payment_status = 'paid_online';
        row.stripe_payment_intent_id = paymentIntentId;
        return [
          {
            id: row.id,
            transaction_id: row.transaction_id ?? null,
            vendor_id: row.vendor_id,
            total: row.total,
            platform_fee: row.platform_fee ?? 0,
          },
        ];
      }

      if (sql.includes("payment_status = 'stripe_pending'") && sql.includes('select id from public.orders')) {
        const orderId = values[0] as string;
        const sessionId = values[1] as string;
        const row = orders.find(
          (o) =>
            o.id === orderId &&
            o.stripe_checkout_session_id === sessionId &&
            o.payment_status === 'stripe_pending',
        );
        return row ? [{ id: row.id }] : [];
      }

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

    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ');

      if (sql.includes("payment_status = 'stripe_pending'")) {
        const [sessionId, orderId] = values as [string, string];
        const row = orders.find((o) => o.id === orderId);
        if (row) {
          row.stripe_checkout_session_id = sessionId;
          row.payment_status = 'stripe_pending';
        }
        return 1;
      }

      if (sql.includes('vendor_settlements')) {
        return 1;
      }

      return 0;
    }),
  };
}

/** In-memory Prisma double for Stripe checkout + webhook order mutations. */
export function createFakeOrderPrisma(seed?: FakeOrderRow[]): FakeOrderPrisma {
  const orders: FakeOrderRow[] = (seed ?? []).map((o) => ({ ...o }));
  const txClient = createTxClient(orders);

  const prisma = {
    $queryRaw: txClient.$queryRaw,
    $executeRaw: txClient.$executeRaw,
    $transaction: jest.fn(async (fn: (client: typeof txClient) => Promise<unknown>) =>
      fn(txClient),
    ),
    vendor: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  return { prisma: prisma as unknown as PrismaService, orders };
}
