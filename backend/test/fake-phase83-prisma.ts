/**
 * In-memory Prisma double for Phase 83 lifecycle E2E
 * (V2V connections, flash promo, creator media ingest).
 */

import { randomUUID } from 'node:crypto';

import type { PrismaService } from '../src/prisma/prisma.service';

type AnyRecord = Record<string, unknown>;

export interface Phase83Store {
  vendors: AnyRecord[];
  vendor_connections: AnyRecord[];
  posts: AnyRecord[];
}

export interface FakePhase83Prisma {
  prisma: PrismaService;
  store: Phase83Store;
}

function now(): Date {
  return new Date();
}

export function createFakePhase83Prisma(seed?: Partial<Phase83Store>): FakePhase83Prisma {
  const store: Phase83Store = {
    vendors: seed?.vendors ?? [],
    vendor_connections: seed?.vendor_connections ?? [],
    posts: seed?.posts ?? [],
  };

  const prisma = {
    vendor: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { id: string };
        select?: Record<string, boolean>;
      }) => {
        const row = store.vendors.find((v) => v.id === where.id);
        if (!row) return null;
        if (!select) return { ...row };
        const out: AnyRecord = {};
        for (const key of Object.keys(select)) {
          if (select[key]) out[key] = row[key];
        }
        return out;
      },
      findFirst: async ({
        where,
        select,
      }: {
        where: { userId?: string; id?: string };
        select?: Record<string, boolean>;
      }) => {
        const row = store.vendors.find((v) => {
          if (where.id && v.id !== where.id) return false;
          if (where.userId && v.userId !== where.userId) return false;
          return true;
        });
        if (!row) return null;
        if (!select) return { ...row };
        const out: AnyRecord = {};
        for (const key of Object.keys(select)) {
          if (select[key]) out[key] = row[key];
        }
        return out;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: AnyRecord;
      }) => {
        const idx = store.vendors.findIndex((v) => v.id === where.id);
        if (idx < 0) throw new Error('VENDOR_NOT_FOUND');
        store.vendors[idx] = { ...store.vendors[idx], ...data, updatedAt: now() };
        return { ...store.vendors[idx] };
      },
    },
    vendorConnection: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = store.vendor_connections.find((r) => r.id === where.id);
        return row ? { ...row } : null;
      },
      findFirst: async ({
        where,
      }: {
        where: {
          OR?: Array<{ senderId: string; receiverId: string }>;
        };
      }) => {
        const clauses = where.OR ?? [];
        const row = store.vendor_connections.find((r) =>
          clauses.some(
            (c) => r.senderId === c.senderId && r.receiverId === c.receiverId,
          ),
        );
        return row ? { ...row } : null;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: {
          OR?: Array<{ senderId?: string; receiverId?: string }>;
        };
        orderBy?: { updatedAt?: 'asc' | 'desc' };
      }) => {
        let rows = [...store.vendor_connections];
        if (where?.OR?.length) {
          rows = rows.filter((r) =>
            where.OR!.some((c) => {
              if (c.senderId && r.senderId === c.senderId) return true;
              if (c.receiverId && r.receiverId === c.receiverId) return true;
              return false;
            }),
          );
        }
        if (orderBy?.updatedAt === 'desc') {
          rows.sort(
            (a, b) =>
              new Date(String(b.updatedAt)).getTime() -
              new Date(String(a.updatedAt)).getTime(),
          );
        }
        return rows.map((r) => ({ ...r }));
      },
      create: async ({ data }: { data: AnyRecord }) => {
        const row = {
          id: randomUUID(),
          isFollowing: false,
          receiverIsFollowing: false,
          createdAt: now(),
          updatedAt: now(),
          ...data,
        };
        store.vendor_connections.push(row);
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: AnyRecord;
      }) => {
        const idx = store.vendor_connections.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('CONNECTION_NOT_FOUND');
        store.vendor_connections[idx] = {
          ...store.vendor_connections[idx],
          ...data,
          updatedAt: now(),
        };
        return { ...store.vendor_connections[idx] };
      },
    },
    post: {
      create: async ({ data }: { data: AnyRecord }) => {
        const row = {
          id: randomUUID(),
          publishAt: now(),
          createdAt: now(),
          ...data,
        };
        store.posts.push(row);
        return { ...row };
      },
      findMany: async ({
        where,
        orderBy,
        take,
        include,
      }: {
        where?: AnyRecord;
        orderBy?: { publishAt?: 'asc' | 'desc' };
        take?: number;
        include?: { vendor?: { select?: Record<string, boolean> } };
      }) => {
        let rows = store.posts.filter((p) => p.mediaUrl != null);
        if (orderBy?.publishAt === 'desc') {
          rows.sort(
            (a, b) =>
              new Date(String(b.publishAt ?? b.createdAt)).getTime() -
              new Date(String(a.publishAt ?? a.createdAt)).getTime(),
          );
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows.map((row) => {
          const out: AnyRecord = { ...row };
          if (include?.vendor) {
            const vendor = store.vendors.find((v) => v.id === row.vendorId);
            out.vendor = vendor
              ? {
                  id: vendor.id,
                  businessName: vendor.businessName ?? null,
                }
              : null;
          }
          // silence unused where for stub
          void where;
          return out;
        });
      },
    },
  };

  return { prisma: prisma as unknown as PrismaService, store };
}
