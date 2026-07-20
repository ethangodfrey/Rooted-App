import { randomUUID } from 'node:crypto';

import type { PrismaService } from '../src/prisma/prisma.service';

type AnyRecord = Record<string, unknown>;

export interface PlatformStore {
  users: AnyRecord[];
  vendors: AnyRecord[];
  farmers: AnyRecord[];
  wholesale_listings: AnyRecord[];
  b2b_procurement_requests: AnyRecord[];
  financial_transactions: AnyRecord[];
  farmer_balances: AnyRecord[];
  vendor_balances: AnyRecord[];
  catering_inquiries: AnyRecord[];
  delivery_routes: AnyRecord[];
  delivery_stops: AnyRecord[];
  notifications_log: AnyRecord[];
  notification_logs: AnyRecord[];
}

export interface FakePlatformPrisma {
  prisma: PrismaService;
  store: PlatformStore;
}

function unwrapSql(arg: unknown, rest: unknown[]): { text: string; values: unknown[] } {
  if (arg && typeof arg === 'object' && 'strings' in (arg as object) && 'values' in (arg as object)) {
    const sql = arg as { strings: string[]; values: unknown[]; text?: string };
    return {
      text: (sql.text ?? sql.strings.join('?')).replace(/\s+/g, ' ').trim(),
      values: [...sql.values],
    };
  }
  if (Array.isArray(arg) && 'raw' in (arg as object)) {
    const strings = arg as unknown as TemplateStringsArray;
    return {
      text: strings.join('?').replace(/\s+/g, ' ').trim(),
      values: rest,
    };
  }
  return { text: String(arg ?? ''), values: rest };
}

function lower(text: string): string {
  return text.toLowerCase();
}

function now(): Date {
  return new Date();
}

/**
 * In-memory Prisma double for the platform golden-path E2E.
 * Implements $queryRaw / $executeRaw enough for clearing, logistics, B2B, and notifications.
 */
export function createFakePlatformPrisma(
  seed?: Partial<PlatformStore>,
): FakePlatformPrisma {
  const store: PlatformStore = {
    users: seed?.users ?? [],
    vendors: seed?.vendors ?? [],
    farmers: seed?.farmers ?? [],
    wholesale_listings: seed?.wholesale_listings ?? [],
    b2b_procurement_requests: seed?.b2b_procurement_requests ?? [],
    financial_transactions: seed?.financial_transactions ?? [],
    farmer_balances: seed?.farmer_balances ?? [],
    vendor_balances: seed?.vendor_balances ?? [],
    catering_inquiries: seed?.catering_inquiries ?? [],
    delivery_routes: seed?.delivery_routes ?? [],
    delivery_stops: seed?.delivery_stops ?? [],
    notifications_log: seed?.notifications_log ?? [],
    notification_logs: seed?.notification_logs ?? [],
  };

  const handleQuery = async (text: string, values: unknown[]): Promise<AnyRecord[]> => {
    const sql = lower(text);

    if (sql.includes('from public.catering_inquiries')) {
      const id = String(values[0] ?? '');
      return store.catering_inquiries.filter((row) => row.id === id).map((row) => ({ ...row }));
    }

    if (
      sql.includes('from public.b2b_procurement_requests r') &&
      sql.includes('left join public.wholesale_listings') &&
      sql.includes('where r.id in')
    ) {
      const ids = new Set(values.map(String));
      return store.b2b_procurement_requests
        .filter((row) => ids.has(String(row.id)))
        .map((row) => {
          const listing = store.wholesale_listings.find((l) => l.id === row.listing_id);
          return {
            id: row.id,
            vendor_id: row.vendor_id,
            farmer_id: row.farmer_id,
            status: row.status,
            requested_quantity: row.requested_quantity,
            escrow_transaction_id: row.escrow_transaction_id,
            bulk_unit_price: listing?.bulk_unit_price ?? null,
          };
        });
    }

    if (
      sql.includes('from public.b2b_procurement_requests r') &&
      sql.includes('join public.farmers f') &&
      sql.includes('select r.id, f.stripe_account_id')
    ) {
      const id = String(values[0] ?? '');
      const row = store.b2b_procurement_requests.find((r) => r.id === id);
      if (!row) return [];
      const farmer = store.farmers.find((f) => f.id === row.farmer_id);
      return [{ id: row.id, stripe_account_id: farmer?.stripe_account_id ?? null }];
    }

    if (
      sql.includes('from public.b2b_procurement_requests') &&
      sql.includes('select') &&
      sql.includes('deposit_cents') &&
      sql.includes('escrow_transaction_id')
    ) {
      const id = String(values[0] ?? '');
      const row = store.b2b_procurement_requests.find((r) => r.id === id);
      if (!row) return [];
      return [
        {
          id: row.id,
          vendor_id: row.vendor_id,
          farmer_id: row.farmer_id,
          status: row.status,
          deposit_cents: row.deposit_cents,
          escrow_transaction_id: row.escrow_transaction_id,
        },
      ];
    }

    if (
      sql.includes('from public.b2b_procurement_requests') &&
      sql.includes('select id, vendor_id, farmer_id, status')
    ) {
      const id = String(values[0] ?? '');
      const row = store.b2b_procurement_requests.find((r) => r.id === id);
      if (!row) return [];
      return [
        {
          id: row.id,
          vendor_id: row.vendor_id,
          farmer_id: row.farmer_id,
          status: row.status,
        },
      ];
    }

    if (sql.includes('from public.farmers') && sql.includes('is_wholesale_supplier')) {
      const id = String(values[0] ?? '');
      const row = store.farmers.find((f) => f.id === id);
      if (!row) return [];
      return [{ id: row.id, is_wholesale_supplier: row.is_wholesale_supplier }];
    }

    if (sql.includes('from public.farmers') && sql.includes('where user_id')) {
      const userId = String(values[0] ?? '');
      return store.farmers.filter((f) => f.user_id === userId).map((f) => ({ id: f.id }));
    }

    if (sql.includes('from public.wholesale_listings') && sql.includes('select id, producer_id')) {
      const id = String(values[0] ?? '');
      const row = store.wholesale_listings.find((l) => l.id === id);
      if (!row) return [];
      return [{ id: row.id, producer_id: row.producer_id }];
    }

    if (
      sql.includes('insert into public.b2b_procurement_requests') &&
      sql.includes('returning id, status')
    ) {
      const vendorId = String(values[0]);
      const farmerId = String(values[1]);
      const listingId = values[2] == null ? null : String(values[2]);
      const message = (values[3] as string | null) ?? null;
      const qty = values[4] == null ? null : Number(values[4]);
      const id = randomUUID();
      const row = {
        id,
        vendor_id: vendorId,
        farmer_id: farmerId,
        listing_id: listingId,
        message,
        requested_quantity: qty,
        status: 'PENDING',
        deposit_cents: null,
        escrow_transaction_id: null,
        created_at: now(),
        updated_at: now(),
      };
      store.b2b_procurement_requests.push(row);
      return [{ id: row.id, status: row.status }];
    }

    if (
      sql.includes('insert into public.financial_transactions') &&
      sql.includes('returning id')
    ) {
      const id = randomUUID();
      const isWholesale = sql.includes("'wholesale'");
      // Wholesale binds voucher as literal 0 → [source, dest, amount, net, ref, meta]
      // Catering binds voucher → [source, dest, amount, voucher, net, ref, meta]
      const source_id = String(values[0]);
      const destination_id = String(values[1]);
      const amount_cents = Number(values[2]);
      let voucher_cents = 0;
      let net_amount_cents: number;
      let reference_id: string;
      let metaBind: unknown;
      if (isWholesale || values.length === 6) {
        voucher_cents = 0;
        net_amount_cents = Number(values[3]);
        reference_id = String(values[4]);
        metaBind = values[5];
      } else {
        voucher_cents = Number(values[3]);
        net_amount_cents = Number(values[4]);
        reference_id = String(values[5]);
        metaBind = values[6];
      }
      let metadata: unknown = {};
      if (typeof metaBind === 'string') {
        try {
          metadata = JSON.parse(metaBind);
        } catch {
          metadata = {};
        }
      } else if (metaBind && typeof metaBind === 'object') {
        metadata = metaBind;
      }
      const row = {
        id,
        source_id,
        destination_id,
        amount_cents,
        voucher_cents,
        net_amount_cents,
        status: 'HELD_IN_ESCROW',
        transaction_type: isWholesale ? 'WHOLESALE' : 'CATERING_DEPOSIT',
        reference_id,
        metadata,
        created_at: now(),
        updated_at: now(),
      };
      store.financial_transactions.push(row);
      return [{ id }];
    }

    if (
      sql.includes('from public.financial_transactions') &&
      sql.includes('select id, status') &&
      sql.includes('net_amount_cents')
    ) {
      const id = String(values[0] ?? '');
      const row = store.financial_transactions.find((t) => t.id === id);
      if (!row) return [];
      return [
        {
          id: row.id,
          status: row.status,
          net_amount_cents: row.net_amount_cents,
          destination_id: row.destination_id,
          transaction_type: row.transaction_type,
          metadata: row.metadata,
        },
      ];
    }

    if (
      sql.includes('insert into public.delivery_routes') &&
      sql.includes('returning id')
    ) {
      const id = randomUUID();
      store.delivery_routes.push({
        id,
        farmer_id: String(values[0]),
        dispatch_date: String(values[1]),
        status: 'SCHEDULED',
        created_at: now(),
        updated_at: now(),
      });
      return [{ id }];
    }

    if (
      sql.includes('insert into public.delivery_stops') &&
      sql.includes('returning id')
    ) {
      const id = randomUUID();
      store.delivery_stops.push({
        id,
        route_id: String(values[0]),
        procurement_request_id: String(values[1]),
        vendor_id: String(values[2]),
        dropoff_order: Number(values[3]),
        status: 'PENDING',
        delivered_at: null,
        updated_at: now(),
      });
      return [{ id }];
    }

    if (
      sql.includes('from public.delivery_stops s') &&
      sql.includes('join public.delivery_routes r') &&
      sql.includes('where s.id')
    ) {
      const stopId = String(values[0] ?? '');
      const stop = store.delivery_stops.find((s) => s.id === stopId);
      if (!stop) return [];
      const route = store.delivery_routes.find((r) => r.id === stop.route_id);
      if (!route) return [];
      return [
        {
          id: stop.id,
          route_id: stop.route_id,
          procurement_request_id: stop.procurement_request_id,
          vendor_id: stop.vendor_id,
          status: stop.status,
          farmer_id: route.farmer_id,
        },
      ];
    }

    if (
      sql.includes('select count(*)') &&
      sql.includes('from public.delivery_stops') &&
      sql.includes("status = 'pending'")
    ) {
      const routeId = String(values[0] ?? '');
      const pending = store.delivery_stops.filter(
        (s) => s.route_id === routeId && s.status === 'PENDING',
      ).length;
      return [{ pending }];
    }

    if (
      sql.includes('from public.vendors v') &&
      sql.includes('join public.users u') &&
      sql.includes('where v.id')
    ) {
      const vendorId = String(values[0] ?? '');
      const vendor = store.vendors.find((v) => v.id === vendorId);
      if (!vendor) return [];
      const user = store.users.find((u) => u.id === vendor.user_id);
      if (!user) return [];
      return [
        {
          user_id: user.id,
          email: user.email ?? null,
          phone: user.phone ?? null,
          notification_preferences: user.notification_preferences ?? null,
        },
      ];
    }

    if (
      sql.includes('from public.farmers f') &&
      sql.includes('join public.users u') &&
      sql.includes('where f.id')
    ) {
      const farmerId = String(values[0] ?? '');
      const farmer = store.farmers.find((f) => f.id === farmerId);
      if (!farmer) return [];
      const user = store.users.find((u) => u.id === farmer.user_id);
      if (!user) return [];
      return [
        {
          user_id: user.id,
          email: user.email ?? null,
          phone: user.phone ?? null,
          notification_preferences: user.notification_preferences ?? null,
        },
      ];
    }

    if (sql.includes('from public.users') && sql.includes('notification_preferences')) {
      const userId = String(values[0] ?? '');
      const user = store.users.find((u) => u.id === userId);
      if (!user) return [];
      return [
        {
          user_id: user.id,
          email: user.email ?? null,
          phone: user.phone ?? null,
          notification_preferences: user.notification_preferences ?? null,
        },
      ];
    }

    if (sql.includes('from public.vendors') && sql.includes('select user_id')) {
      const vendorId = String(values[0] ?? '');
      const vendor = store.vendors.find((v) => v.id === vendorId);
      if (!vendor) return [];
      return [{ user_id: vendor.user_id }];
    }

    if (sql.includes('from public.farmer_balances') && sql.includes('select')) {
      const farmerId = String(values[0] ?? '');
      const row = store.farmer_balances.find((b) => b.farmer_id === farmerId);
      if (!row) return [];
      return [
        {
          available_cents: row.available_cents,
          escrow_held_cents: row.escrow_held_cents,
        },
      ];
    }

    if (sql.includes('select public.enqueue_notification')) {
      throw new Error('ENQUEUE_NOTIFICATION_UNAVAILABLE');
    }

    return [];
  };

  const handleExecute = async (text: string, values: unknown[]): Promise<number> => {
    const sql = lower(text);

    if (sql.includes('select public.enqueue_notification')) {
      throw new Error('ENQUEUE_NOTIFICATION_UNAVAILABLE');
    }

    if (sql.includes('insert into public.notification_logs')) {
      store.notification_logs.push({
        id: randomUUID(),
        user_id: String(values[0]),
        title: String(values[1]),
        body: String(values[2]),
        notification_type: String(values[3] ?? 'CONNECTION_REQUEST'),
        created_at: now(),
      });
      return 1;
    }

    if (sql.includes('insert into public.notifications_log')) {
      store.notifications_log.push({
        id: randomUUID(),
        user_id: String(values[0]),
        channel: String(values[1]),
        event_type: String(values[2]),
        status: String(values[3]),
        destination: values[4] ?? null,
        subject: values[5] ?? null,
        body: values[6] ?? null,
        metadata:
          typeof values[7] === 'string'
            ? (() => {
                try {
                  return JSON.parse(values[7] as string);
                } catch {
                  return {};
                }
              })()
            : values[7] ?? {},
        created_at: now(),
      });
      return 1;
    }

    if (
      sql.includes('insert into public.farmer_balances') &&
      sql.includes('on conflict')
    ) {
      const farmerId = String(values[0]);
      if (!store.farmer_balances.some((b) => b.farmer_id === farmerId)) {
        store.farmer_balances.push({
          farmer_id: farmerId,
          available_cents: 0,
          escrow_held_cents: 0,
          updated_at: now(),
        });
      }
      return 1;
    }

    if (
      sql.includes('insert into public.vendor_balances') &&
      sql.includes('on conflict')
    ) {
      const vendorId = String(values[0]);
      if (!store.vendor_balances.some((b) => b.vendor_id === vendorId)) {
        store.vendor_balances.push({
          vendor_id: vendorId,
          available_cents: 0,
          escrow_held_cents: 0,
          loyalty_liability_cents: 0,
          micro_fee_cents: 0,
          updated_at: now(),
        });
      }
      return 1;
    }

    if (
      sql.includes('update public.farmer_balances') &&
      sql.includes('available_cents = available_cents +') &&
      sql.includes('greatest')
    ) {
      // GREATEST(0, escrow - $1), available + $2 WHERE farmer_id = $3
      const net = Number(values[0]);
      const farmerId = String(values[2] ?? values[1]);
      const row = store.farmer_balances.find((b) => b.farmer_id === farmerId);
      if (row) {
        row.escrow_held_cents = Math.max(0, Number(row.escrow_held_cents) - net);
        row.available_cents = Number(row.available_cents) + net;
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.farmer_balances') &&
      sql.includes('escrow_held_cents = escrow_held_cents +')
    ) {
      const amount = Number(values[0]);
      const farmerId = String(values[1]);
      const row = store.farmer_balances.find((b) => b.farmer_id === farmerId);
      if (row) {
        row.escrow_held_cents = Number(row.escrow_held_cents) + amount;
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.farmer_balances') &&
      sql.includes('escrow_held_cents = greatest')
    ) {
      const net = Number(values[0]);
      const farmerId = String(values[1]);
      const row = store.farmer_balances.find((b) => b.farmer_id === farmerId);
      if (row) {
        row.escrow_held_cents = Math.max(0, Number(row.escrow_held_cents) - net);
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.b2b_procurement_requests') &&
      sql.includes('deposit_cents') &&
      sql.includes('escrow_transaction_id')
    ) {
      const deposit = Number(values[0]);
      const txId = String(values[1]);
      const id = String(values[2]);
      const row = store.b2b_procurement_requests.find((r) => r.id === id);
      if (row) {
        row.deposit_cents = deposit;
        row.escrow_transaction_id = txId;
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.b2b_procurement_requests') &&
      sql.includes("status = 'accepted'") &&
      sql.includes("status = 'pending'")
    ) {
      const id = String(values[0]);
      const row = store.b2b_procurement_requests.find(
        (r) => r.id === id && r.status === 'PENDING',
      );
      if (row) {
        row.status = 'ACCEPTED';
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.b2b_procurement_requests') &&
      sql.includes('set status =')
    ) {
      const status = String(values[0]);
      const id = String(values[1]);
      const row = store.b2b_procurement_requests.find((r) => r.id === id);
      if (row) {
        row.status = status;
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.financial_transactions') &&
      sql.includes("status = 'settled'")
    ) {
      const id = String(values[0]);
      const row = store.financial_transactions.find((t) => t.id === id);
      if (row) {
        row.status = 'SETTLED';
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.financial_transactions') &&
      sql.includes('metadata = coalesce')
    ) {
      const metaRaw = values[0];
      const id = String(values[1]);
      const row = store.financial_transactions.find((t) => t.id === id);
      if (row) {
        let patch: Record<string, unknown> = {};
        if (typeof metaRaw === 'string') {
          try {
            patch = JSON.parse(metaRaw) as Record<string, unknown>;
          } catch {
            patch = {};
          }
        } else if (metaRaw && typeof metaRaw === 'object') {
          patch = metaRaw as Record<string, unknown>;
        }
        row.metadata = {
          ...((row.metadata as Record<string, unknown>) ?? {}),
          ...patch,
        };
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.delivery_stops') &&
      sql.includes("status = 'delivered'")
    ) {
      const id = String(values[0]);
      const row = store.delivery_stops.find((s) => s.id === id);
      if (row) {
        row.status = 'DELIVERED';
        row.delivered_at = now();
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.delivery_routes') &&
      sql.includes("status = 'in_transit'")
    ) {
      const id = String(values[0]);
      const row = store.delivery_routes.find(
        (r) => r.id === id && r.status === 'SCHEDULED',
      );
      if (row) {
        row.status = 'IN_TRANSIT';
        row.updated_at = now();
      }
      return 1;
    }

    if (
      sql.includes('update public.delivery_routes') &&
      sql.includes("status = 'completed'")
    ) {
      const id = String(values[0]);
      const row = store.delivery_routes.find((r) => r.id === id);
      if (row) {
        row.status = 'COMPLETED';
        row.updated_at = now();
      }
      return 1;
    }

    return 0;
  };

  const prisma = {
    async $queryRaw(arg: unknown, ...rest: unknown[]) {
      const { text, values } = unwrapSql(arg, rest);
      return handleQuery(text, values);
    },
    async $executeRaw(arg: unknown, ...rest: unknown[]) {
      const { text, values } = unwrapSql(arg, rest);
      return handleExecute(text, values);
    },
    async $transaction(fn: (tx: unknown) => Promise<unknown>) {
      return fn(prisma);
    },
  };

  return { prisma: prisma as unknown as PrismaService, store };
}
