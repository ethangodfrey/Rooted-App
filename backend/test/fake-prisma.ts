import { randomUUID } from 'node:crypto';

import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Minimal in-memory Prisma test double implementing only the delegate methods
 * used by PosImportService / PosMappingService / PosAnalyticsService. It is
 * faithful to the real semantics that matter for these tests: composite-unique
 * lookups, nested line-item creates, interactive $transaction, and case-
 * insensitive product matching. The same specs can run against a real Postgres
 * by swapping this double for a PrismaService pointed at a test database.
 */
type AnyRecord = Record<string, any>;

interface SoldAtFilter {
  gte?: Date;
  lte?: Date;
}

export interface FakePrismaStore {
  products: AnyRecord[];
  productMappings: AnyRecord[];
  locationMappings: AnyRecord[];
  transactions: AnyRecord[];
  lineItems: AnyRecord[];
  inventoryTransactions: AnyRecord[];
  snapshots: AnyRecord[];
  syncErrors: AnyRecord[];
}

export interface FakePrisma {
  prisma: PrismaService;
  store: FakePrismaStore;
}

export function createFakePrisma(seed?: Partial<FakePrismaStore>): FakePrisma {
  const store: FakePrismaStore = {
    products: seed?.products ?? [],
    productMappings: seed?.productMappings ?? [],
    locationMappings: seed?.locationMappings ?? [],
    transactions: seed?.transactions ?? [],
    lineItems: seed?.lineItems ?? [],
    inventoryTransactions: seed?.inventoryTransactions ?? [],
    snapshots: seed?.snapshots ?? [],
    syncErrors: seed?.syncErrors ?? [],
  };

  const hydrate = (txn: AnyRecord, include?: AnyRecord): AnyRecord => {
    const out = { ...txn };
    if (include?.lineItems) {
      out.lineItems = store.lineItems
        .filter((li) => li.transactionId === txn.id)
        .map((li) => ({ ...li }));
    }
    return out;
  };

  const matchTxn = (txn: AnyRecord, where: AnyRecord): boolean => {
    if (where.vendorId && txn.vendorId !== where.vendorId) return false;
    if (where.connectionId && txn.connectionId !== where.connectionId) return false;
    if (where.state && txn.state !== where.state) return false;
    if (where.soldAt) {
      const f = where.soldAt as SoldAtFilter;
      const t = new Date(txn.soldAt).getTime();
      if (f.gte && t < f.gte.getTime()) return false;
      if (f.lte && t > f.lte.getTime()) return false;
    }
    return true;
  };

  const prisma = {
    async $transaction(fn: (tx: any) => Promise<unknown>) {
      return fn(prisma);
    },

    posImportedTransaction: {
      async findUnique({ where, include }: AnyRecord) {
        let txn: AnyRecord | undefined;
        if (where.id) {
          txn = store.transactions.find((t) => t.id === where.id);
        } else if (where.connectionId_providerTransactionId) {
          const { connectionId, providerTransactionId } =
            where.connectionId_providerTransactionId;
          txn = store.transactions.find(
            (t) =>
              t.connectionId === connectionId &&
              t.providerTransactionId === providerTransactionId,
          );
        }
        return txn ? hydrate(txn, include) : null;
      },

      async findMany({ where, include }: AnyRecord) {
        return store.transactions
          .filter((t) => matchTxn(t, where ?? {}))
          .map((t) => hydrate(t, include));
      },

      async create({ data }: AnyRecord) {
        const id = randomUUID();
        const { lineItems, ...rest } = data;
        const txn: AnyRecord = {
          ...rest,
          id,
          soldAt: rest.soldAt instanceof Date ? rest.soldAt : new Date(rest.soldAt),
          discountAmount: rest.discountAmount ?? 0,
          taxAmount: rest.taxAmount ?? 0,
          tipAmount: rest.tipAmount ?? 0,
        };
        store.transactions.push(txn);
        for (const li of lineItems?.create ?? []) {
          const productId = li.product?.connect?.id ?? li.productId ?? null;
          store.lineItems.push({
            ...li,
            id: randomUUID(),
            transactionId: id,
            productId,
            product: undefined,
            inventoryTransactionId: li.inventoryTransactionId ?? null,
          });
        }
        return { ...txn };
      },

      async update({ where, data }: AnyRecord) {
        const txn = store.transactions.find((t) => t.id === where.id);
        if (txn) Object.assign(txn, data);
        return { ...txn };
      },
    },

    posImportedLineItem: {
      async update({ where, data }: AnyRecord) {
        const li = store.lineItems.find((x) => x.id === where.id);
        if (li) Object.assign(li, data);
        return { ...li };
      },
    },

    posProductMapping: {
      async findUnique({ where }: AnyRecord) {
        const { connectionId, providerCatalogObjectId } =
          where.connectionId_providerCatalogObjectId;
        const m = store.productMappings.find(
          (x) =>
            x.connectionId === connectionId &&
            x.providerCatalogObjectId === providerCatalogObjectId,
        );
        return m ? { ...m } : null;
      },
      async create({ data }: AnyRecord) {
        const m = { ...data, id: randomUUID() };
        store.productMappings.push(m);
        return { ...m };
      },
    },

    posLocationMapping: {
      async findUnique({ where }: AnyRecord) {
        const { connectionId, providerLocationId } =
          where.connectionId_providerLocationId;
        const m = store.locationMappings.find(
          (x) =>
            x.connectionId === connectionId &&
            x.providerLocationId === providerLocationId,
        );
        return m ? { ...m } : null;
      },
    },

    product: {
      async findFirst({ where }: AnyRecord) {
        const target = where.name?.equals;
        const insensitive = where.name?.mode === 'insensitive';
        const p = store.products.find(
          (x) =>
            x.vendorId === where.vendorId &&
            (insensitive
              ? x.name.toLowerCase() === String(target).toLowerCase()
              : x.name === target),
        );
        return p ? { ...p } : null;
      },
    },

    inventoryTransaction: {
      async create({ data }: AnyRecord) {
        const row = { ...data, id: randomUUID(), createdAt: new Date() };
        store.inventoryTransactions.push(row);
        return { ...row };
      },
    },

    analyticsSnapshot: {
      async upsert({ where, create, update }: AnyRecord) {
        const { vendorId, date } = where.vendorId_date;
        const existing = store.snapshots.find(
          (s) => s.vendorId === vendorId && s.date.getTime() === date.getTime(),
        );
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }
        const row = { ...create, id: randomUUID() };
        store.snapshots.push(row);
        return { ...row };
      },
    },

    posSyncError: {
      async create({ data }: AnyRecord) {
        const row = { ...data, id: randomUUID() };
        store.syncErrors.push(row);
        return { ...row };
      },
    },
  };

  return { prisma: prisma as unknown as PrismaService, store };
}
