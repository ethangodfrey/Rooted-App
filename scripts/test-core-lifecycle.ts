/**
 * Core Lifecycle E2E Integration Simulation
 *
 * Orchestrates Discovery -> Reservation -> Handoff against seeded Denver data.
 *
 * Usage:
 *   npm run test:integration:core
 *
 * Environment (loaded from .env, backend/.env):
 *   DATABASE_URL
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEST_API_URL / VITE_API_URL / API_URL   Default: http://localhost:4000
 *   LIFECYCLE_SHOPPER_ACCESS_TOKEN         Optional shopper JWT override
 *   LIFECYCLE_VENDOR_ACCESS_TOKEN          Optional vendor JWT override
 *   LIFECYCLE_SHOPPER_EMAIL                Default: shopper-01@network-seed.vendorly.local
 *   LIFECYCLE_VENDOR_EMAIL                 Default: vendor-01@network-seed.vendorly.local
 *   LIFECYCLE_TEST_PASSWORD                Password applied to seed users for sign-in
 */

import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';

/** Resolve CJS Prisma client from backend install (no import.meta; NodeNext CJS-safe). */
const nodeRequire = createRequire(
  pathToFileURL(resolve(process.cwd(), 'scripts/test-core-lifecycle.ts')).href,
);

const RESERVATION_QTY = 1;
const DENVER_BOUNDS = {
  min_lat: 39.65,
  max_lat: 39.85,
  min_lng: -105.1,
  max_lng: -104.85,
} as const;
const SEED_SHOPPER_EMAIL = 'shopper-01@network-seed.vendorly.local';
const SEED_VENDOR_EMAIL = 'vendor-01@network-seed.vendorly.local';
const DEFAULT_TEST_PASSWORD = 'LifecycleTest428e!';

type PrismaLike = {
  $queryRaw: <T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};

type SpatialVendor = {
  profile_id: string;
  display_name: string;
  business_row_id: string;
  entity_kind: string;
  latitude: number | string;
  longitude: number | string;
};

type ProductRow = {
  id: string;
  name: string;
  stock: number;
  sku: string | null;
  vendor_id: string;
};

type OrderRow = {
  id: string;
  status: string;
  pickup_code: string;
  shopper_id: string;
};

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadLifecycleEnv(): void {
  const root = process.cwd();
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));
}

function log(message: string): void {
  console.log(message);
}

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function resolveSupabaseUrl(): string {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    '';
  assert(url, 'SUPABASE_URL or VITE_SUPABASE_URL is required');
  return url.replace(/\/$/, '');
}

function resolveAnonKey(): string {
  const key =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    '';
  assert(key, 'SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY is required');
  return key;
}

function resolveServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function resolveApiBase(): string {
  const base =
    process.env.NEST_API_URL?.trim() ||
    process.env.VITE_API_URL?.trim() ||
    process.env.API_URL?.trim() ||
    'http://localhost:4000';
  return base.replace(/\/$/, '');
}

function createPrisma(): PrismaLike {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  assert(databaseUrl, 'DATABASE_URL is required');
  const clientPath = resolve(process.cwd(), 'backend/node_modules/@prisma/client');
  assert(existsSync(clientPath), 'backend/node_modules/@prisma/client is missing');
  const { PrismaClient } = nodeRequire(clientPath) as {
    PrismaClient: new (args?: {
      datasources?: { db: { url: string } };
    }) => PrismaLike;
  };
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function ensurePasswordAndSignIn(
  prisma: PrismaLike,
  email: string,
  password: string,
): Promise<{ accessToken: string; userId: string }> {
  const url = resolveSupabaseUrl();
  const anonKey = resolveAnonKey();
  const serviceKey = resolveServiceRoleKey();

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const idRows = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text as id
    from auth.users
    where lower(email) = lower(${email})
    limit 1
  `;
  const userId = idRows[0]?.id;
  assert(userId, `AUTH_USER_MISSING: ${email}`);

  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      fail(`AUTH_PASSWORD_SET_FAILED: ${updated.error.message}`);
    }
  } else {
    log('AUTH: SERVICE_ROLE_MISSING - APPLYING SQL AUTH REPAIR');
  }

  // Network seed inserts auth.users without GoTrue-compatible defaults/identities.
  try {
    await prisma.$executeRaw`
      update auth.users
      set
        instance_id = '00000000-0000-0000-0000-000000000000',
        aud = 'authenticated',
        role = 'authenticated',
        encrypted_password = crypt(${password}, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        raw_app_meta_data = coalesce(
          raw_app_meta_data,
          '{"provider":"email","providers":["email"]}'::jsonb
        ),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
        is_sso_user = false,
        is_anonymous = false,
        updated_at = now()
      where id = ${userId}::uuid
    `;

    await prisma.$executeRaw`
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        ${userId}::uuid,
        ${userId}::uuid,
        jsonb_build_object(
          'sub', ${userId},
          'email', ${email},
          'email_verified', true
        ),
        'email',
        ${userId},
        now(),
        now(),
        now()
      )
      on conflict do nothing
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fail(`AUTH_SQL_REPAIR_FAILED: ${message}`);
  }

  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session?.access_token || !signed.data.user?.id) {
    fail(
      `AUTH_SIGN_IN_FAILED for ${email}: ${signed.error?.message || 'NO_SESSION'}`,
    );
  }

  return {
    accessToken: signed.data.session.access_token,
    userId: signed.data.user.id,
  };
}

async function resolveShopperAuth(prisma: PrismaLike): Promise<{
  accessToken: string;
  userId: string;
  email: string;
}> {
  const token = process.env.LIFECYCLE_SHOPPER_ACCESS_TOKEN?.trim();
  if (token) {
    const url = resolveSupabaseUrl();
    const anon = createClient(url, resolveAnonKey(), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.getUser(token);
    assert(
      !error && data.user?.id,
      `SHOPPER_TOKEN_INVALID: ${error?.message || 'NO_USER'}`,
    );
    return {
      accessToken: token,
      userId: data.user.id,
      email: data.user.email || 'TOKEN_SHOPPER',
    };
  }

  const email =
    process.env.LIFECYCLE_SHOPPER_EMAIL?.trim() || SEED_SHOPPER_EMAIL;
  const password =
    process.env.LIFECYCLE_TEST_PASSWORD?.trim() || DEFAULT_TEST_PASSWORD;
  const auth = await ensurePasswordAndSignIn(prisma, email, password);
  return { ...auth, email };
}

async function resolveVendorAuth(
  prisma: PrismaLike,
  vendorProfileId: string,
): Promise<{
  accessToken: string;
  userId: string;
  email: string;
}> {
  const token = process.env.LIFECYCLE_VENDOR_ACCESS_TOKEN?.trim();
  if (token) {
    const url = resolveSupabaseUrl();
    const anon = createClient(url, resolveAnonKey(), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.getUser(token);
    assert(
      !error && data.user?.id,
      `VENDOR_TOKEN_INVALID: ${error?.message || 'NO_USER'}`,
    );
    assert(
      data.user.id === vendorProfileId,
      `VENDOR_TOKEN_MISMATCH: expected ${vendorProfileId} got ${data.user.id}`,
    );
    return {
      accessToken: token,
      userId: data.user.id,
      email: data.user.email || 'TOKEN_VENDOR',
    };
  }

  const rows = await prisma.$queryRaw<Array<{ email: string }>>`
    select email
    from public.users
    where id = ${vendorProfileId}::uuid
    limit 1
  `;
  const email =
    process.env.LIFECYCLE_VENDOR_EMAIL?.trim() ||
    rows[0]?.email ||
    SEED_VENDOR_EMAIL;
  const password =
    process.env.LIFECYCLE_TEST_PASSWORD?.trim() || DEFAULT_TEST_PASSWORD;
  const auth = await ensurePasswordAndSignIn(prisma, email, password);
  assert(
    auth.userId === vendorProfileId,
    `VENDOR_AUTH_MISMATCH: expected ${vendorProfileId} got ${auth.userId}`,
  );
  return { ...auth, email };
}

async function stepADiscover(
  prisma: PrismaLike,
): Promise<{ vendor: SpatialVendor; product: ProductRow; stockBefore: number }> {
  log('STEP A: RUNNING - SPATIAL FETCH');

  const vendors = await prisma.$queryRaw<SpatialVendor[]>`
    select
      profile_id::text as profile_id,
      display_name,
      business_row_id::text as business_row_id,
      entity_kind,
      latitude,
      longitude
    from public.get_tracked_businesses_in_bounds(
      ${DENVER_BOUNDS.min_lat}::numeric,
      ${DENVER_BOUNDS.max_lat}::numeric,
      ${DENVER_BOUNDS.min_lng}::numeric,
      ${DENVER_BOUNDS.max_lng}::numeric,
      null::text[]
    )
    where entity_kind = 'vendor'
    order by display_name asc
  `;

  assert(
    vendors.length > 0,
    'SPATIAL_FETCH_EMPTY: no seeded vendors in Denver bounds',
  );

  const preferredEmail =
    process.env.LIFECYCLE_VENDOR_EMAIL?.trim() || SEED_VENDOR_EMAIL;
  const emailRows = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text as id
    from public.users
    where lower(email) = lower(${preferredEmail})
    limit 1
  `;
  const preferredId = emailRows[0]?.id;
  const vendor =
    vendors.find((v) => v.profile_id === preferredId) || vendors[0];
  assert(vendor, 'SPATIAL_VENDOR_UNRESOLVED');

  const products = await prisma.$queryRaw<ProductRow[]>`
    select
      p.id::text as id,
      p.name,
      p.stock,
      p.sku,
      p.vendor_id::text as vendor_id
    from public.products p
    where p.vendor_id = ${vendor.business_row_id}::uuid
      and p.status = 'active'
      and p.stock >= ${RESERVATION_QTY}
    order by
      case when p.sku like 'SEED-V-%' then 0 else 1 end,
      p.stock desc,
      p.name asc
    limit 1
  `;

  const product = products[0];
  assert(product, `PRODUCT_UNRESOLVED for vendor ${vendor.profile_id}`);

  log(
    `STEP A: SUCCESS - SPATIAL FETCH PASSED VENDOR=${vendor.display_name} PRODUCT=${product.name} STOCK=${product.stock}`,
  );

  return { vendor, product, stockBefore: Number(product.stock) };
}

async function stepBCreateOrder(args: {
  apiBase: string;
  shopperToken: string;
  vendorUserId: string;
  productId: string;
  quantity: number;
}): Promise<{ orderId: string; pickupCode: string; shopperId: string }> {
  log('STEP B: RUNNING - ORDER CREATE');

  const response = await fetch(`${args.apiBase}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.shopperToken}`,
    },
    body: JSON.stringify({
      product_id: args.productId,
      vendor_user_id: args.vendorUserId,
      quantity: args.quantity,
      payment_method: 'PAY_AT_HANDOFF',
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    STATUS?: string;
    ORDER_ID?: string;
    PICKUP_CODE?: string;
    SHOPPER_ID?: string;
    message?: string | string[];
    statusCode?: number;
  } | null;

  if (!response.ok || payload?.STATUS !== 'SUCCESS' || !payload.PICKUP_CODE) {
    fail(`ORDER_CREATE_HTTP_${response.status}: ${JSON.stringify(payload)}`);
  }

  const pickupCode = String(payload.PICKUP_CODE).trim().toUpperCase();
  assert(
    /^[A-Z0-9]{2}-[A-Z0-9]{3}$/.test(pickupCode),
    `PICKUP_CODE_FORMAT_INVALID: ${pickupCode}`,
  );

  log(
    `STEP B: SUCCESS - ORDER CREATED ORDER=${payload.ORDER_ID} PICKUP_CODE=${pickupCode}`,
  );

  return {
    orderId: String(payload.ORDER_ID),
    pickupCode,
    shopperId: String(payload.SHOPPER_ID),
  };
}

async function stepCVerifyHandoff(args: {
  apiBase: string;
  vendorToken: string;
  pickupCode: string;
}): Promise<void> {
  log('STEP C: RUNNING - HANDOFF VERIFY');

  const response = await fetch(`${args.apiBase}/orders/verify-handoff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.vendorToken}`,
    },
    body: JSON.stringify({ code: args.pickupCode }),
  });

  const payload = (await response.json().catch(() => null)) as {
    STATUS?: string;
    CODE?: string;
    REASON?: string;
  } | null;

  if (!response.ok || payload?.STATUS !== 'SUCCESS') {
    fail(`HANDOFF_HTTP_${response.status}: ${JSON.stringify(payload)}`);
  }

  log(`STEP C: SUCCESS - HANDOFF VERIFIED CODE=${payload.CODE}`);
}

async function assertInvariants(args: {
  prisma: PrismaLike;
  orderId: string;
  productId: string;
  shopperId: string;
  stockBefore: number;
  quantity: number;
}): Promise<void> {
  log('ASSERT: RUNNING - TELEMETRY INVARIANTS');

  const orders = await args.prisma.$queryRaw<OrderRow[]>`
    select
      id::text as id,
      status::text as status,
      pickup_code,
      shopper_id::text as shopper_id
    from public.preorder_orders
    where id = ${args.orderId}::uuid
    limit 1
  `;
  const order = orders[0];
  assert(order, `ORDER_MISSING: ${args.orderId}`);
  assert(
    order.status === 'COMPLETED',
    `ORDER_STATUS_EXPECTED_COMPLETED GOT_${order.status}`,
  );
  log('ASSERT: PASS - ORDER STATUS COMPLETED');

  const products = await args.prisma.$queryRaw<Array<{ stock: number }>>`
    select stock
    from public.products
    where id = ${args.productId}::uuid
    limit 1
  `;
  const stockAfter = Number(products[0]?.stock);
  const expectedStock = args.stockBefore - args.quantity;
  assert(
    Number.isFinite(stockAfter) && stockAfter === expectedStock,
    `STOCK_EXPECTED_${expectedStock}_GOT_${stockAfter}`,
  );
  log(
    `ASSERT: PASS - STOCK DECREMENTED BY ${args.quantity} (${args.stockBefore} -> ${stockAfter})`,
  );

  const notifications = await args.prisma.$queryRaw<
    Array<{ title: string; body: string }>
  >`
    select title, body
    from public.notification_logs
    where user_id = ${args.shopperId}::uuid
      and upper(title) = 'ORDER_COMPLETED'
    order by created_at desc
    limit 5
  `;
  assert(
    notifications.length >= 1,
    `NOTIFICATION_LOGS_MISSING ORDER_COMPLETED for shopper ${args.shopperId}`,
  );
  assert(
    notifications.every((n) => n.title === n.title.toUpperCase()),
    'NOTIFICATION_TITLE_NOT_UPPERCASE',
  );
  log(
    `ASSERT: PASS - NOTIFICATION_LOGS ORDER_COMPLETED COUNT=${notifications.length}`,
  );
}

async function main(): Promise<void> {
  loadLifecycleEnv();
  log('SIMULATION_RUNNING');

  const prisma = createPrisma();
  const apiBase = resolveApiBase();

  try {
    const { vendor, product, stockBefore } = await stepADiscover(prisma);

    const shopper = await resolveShopperAuth(prisma);
    log(`AUTH: SHOPPER READY ID=${shopper.userId} EMAIL=${shopper.email}`);

    const vendorAuth = await resolveVendorAuth(prisma, vendor.profile_id);
    log(`AUTH: VENDOR READY ID=${vendorAuth.userId} EMAIL=${vendorAuth.email}`);

    const created = await stepBCreateOrder({
      apiBase,
      shopperToken: shopper.accessToken,
      vendorUserId: vendor.profile_id,
      productId: product.id,
      quantity: RESERVATION_QTY,
    });

    await stepCVerifyHandoff({
      apiBase,
      vendorToken: vendorAuth.accessToken,
      pickupCode: created.pickupCode,
    });

    await assertInvariants({
      prisma,
      orderId: created.orderId,
      productId: product.id,
      shopperId: created.shopperId || shopper.userId,
      stockBefore,
      quantity: RESERVATION_QTY,
    });

    log('PASS: CORE_LIFECYCLE_SIMULATION_COMPLETE');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.startsWith('FAIL:')) {
    log(`FAIL: ${message}`);
  }
  process.exit(1);
});
