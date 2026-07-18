/**
 * Local Network Seeding & Stress-Testing Engine
 * Denver metro high-density mock cluster for map / GIN / B2B filters.
 *
 * Marker: emails end with @network-seed.vendorly.local
 * Deterministic UUIDs under a1380000-0000-4000-* so cleanup is safe.
 */

export type SeedDb = {
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
  $queryRaw: <T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
};

export type LocalNetworkSeedResult = {
  profiles: number;
  shoppers: number;
  vendors: number;
  farmers: number;
  listings: number;
  connections: number;
  follows: number;
  posLinks: number;
};

const SEED_EMAIL_DOMAIN = 'network-seed.vendorly.local';
const DENVER = { lat: 39.7392, lng: -104.9903 };

const SHOPPER_COUNT = 25;
const VENDOR_COUNT = 15;
const FARMER_COUNT = 10;
const CONNECTION_COUNT = 10;
const FOLLOW_COUNT = 30;

const VENDOR_SPECIALTIES = [
  'HOME_BAKER',
  'PRIVATE_CHEF',
  'PREPARED_MEALS',
  'ARTISAN_CRAFTS',
  'APPAREL_BRAND',
  'HOT_FOOD_CATERING',
] as const;

const FARMER_SPECIALTIES = [
  'PRODUCE_VEG',
  'ORCHARD_FRUIT',
  'LIVESTOCK_MEAT',
  'POULTRY_EGGS',
  'DAIRY',
  'APIARY_HONEY',
  'HYDRO_MICROGREENS',
  'FLORICULTURE',
] as const;

const SHOPPER_INTERESTS = [
  'Food & Drink',
  'Baked Goods',
  'Art & Prints',
  'Jewelry',
  'Apparel',
  'Home & Decor',
  'Plants',
  'Candles & Soap',
  'Vintage & Thrift',
  'Handmade Crafts',
  'Wellness',
  'Pet Goods',
] as const;

const DENVER_ZIPS = [
  '80202',
  '80203',
  '80204',
  '80205',
  '80206',
  '80207',
  '80209',
  '80210',
  '80211',
  '80212',
  '80218',
  '80220',
  '80222',
  '80223',
  '80224',
  '80246',
  '80110',
  '80111',
  '80113',
  '80014',
] as const;

function seedUserId(role: 'shopper' | 'vendor' | 'farmer', index: number): string {
  const roleNibble =
    role === 'shopper' ? '81' : role === 'vendor' ? '82' : '83';
  return `a1380000-0000-4000-${roleNibble}00-${String(index).padStart(12, '0')}`;
}

function seedEntityId(kind: 'vendor' | 'farmer' | 'product' | 'conn' | 'follow', index: number): string {
  const kindNibble =
    kind === 'vendor'
      ? '91'
      : kind === 'farmer'
        ? '92'
        : kind === 'product'
          ? '93'
          : kind === 'conn'
            ? '94'
            : '95';
  return `a1380000-0000-4000-${kindNibble}00-${String(index).padStart(12, '0')}`;
}

function seedEmail(role: string, index: number): string {
  return `${role}-${String(index).padStart(2, '0')}@${SEED_EMAIL_DOMAIN}`;
}

function offsetCoord(index: number, spread = 0.08): { lat: number; lng: number } {
  const angle = (index * 47) % 360;
  const radius = 0.008 + ((index * 13) % 17) * (spread / 17);
  const rad = (angle * Math.PI) / 180;
  return {
    lat: Number((DENVER.lat + Math.sin(rad) * radius).toFixed(6)),
    lng: Number((DENVER.lng + Math.cos(rad) * radius).toFixed(6)),
  };
}

function pickInterests(index: number): string[] {
  const count = 2 + (index % 4);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(SHOPPER_INTERESTS[(index + i * 3) % SHOPPER_INTERESTS.length]!);
  }
  return [...new Set(out)];
}

function pgTextArray(values: string[]): string {
  if (values.length === 0) return '{}';
  const escaped = values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `{${escaped.join(',')}}`;
}

async function ensureAuthUser(db: SeedDb, userId: string, email: string): Promise<void> {
  await db.$executeRaw`
    insert into auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      aud,
      role
    ) values (
      ${userId}::uuid,
      ${email},
      '',
      now(),
      now(),
      now(),
      'authenticated',
      'authenticated'
    )
    on conflict (id) do update
    set email = excluded.email, updated_at = now()
  `;

  await db.$executeRaw`
    insert into public.users (id, email)
    values (${userId}::uuid, ${email})
    on conflict (id) do update
    set email = excluded.email, updated_at = now()
  `;
}

async function tryDelete(db: SeedDb, label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Missing tables (older local DBs) are skipped; real failures still surface later.
    if (/does not exist|relation .* does not exist/i.test(message)) {
      console.log(`NETWORK SEED CLEAN SKIP: ${label}`);
      return;
    }
    throw err;
  }
}

async function cleanNetworkSeed(db: SeedDb): Promise<void> {
  const like = `%@${SEED_EMAIL_DOMAIN}`;
  console.log('NETWORK SEED: CLEAN PRIOR MOCK ROWS');

  // Dependents first (respect FK order; products are RESTRICT from preorder items).
  await tryDelete(db, 'PREORDER_ORDER_ITEMS', () => db.$executeRaw`
    delete from public.preorder_order_items
    where order_id in (
      select o.id from public.preorder_orders o
      join public.users u on u.id in (o.shopper_id, o.vendor_id)
      where u.email like ${like}
    )
    or product_id in (
      select p.id from public.products p
      join public.vendors v on v.id = p.vendor_id
      join public.users u on u.id = v.user_id
      where u.email like ${like}
    )
  `);

  await tryDelete(db, 'PREORDER_ORDERS', () => db.$executeRaw`
    delete from public.preorder_orders
    where shopper_id in (select id from public.users where email like ${like})
       or vendor_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'FOLLOWS', () => db.$executeRaw`
    delete from public.follows
    where shopper_id in (select id from public.users where email like ${like})
       or followed_profile_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'CONVERSATION_THREADS', () => db.$executeRaw`
    delete from public.conversation_threads
    where customer_user_id in (select id from public.users where email like ${like})
       or b2b_peer_user_id in (select id from public.users where email like ${like})
       or vendor_connection_id in (
         select id from public.vendor_connections
         where sender_id in (select id from public.users where email like ${like})
            or receiver_id in (select id from public.users where email like ${like})
       )
  `);

  await tryDelete(db, 'VENDOR_CONNECTIONS', () => db.$executeRaw`
    delete from public.vendor_connections
    where sender_id in (select id from public.users where email like ${like})
       or receiver_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'NETWORK_CONNECTIONS', () => db.$executeRaw`
    delete from public.network_connections
    where sender_id in (select id from public.users where email like ${like})
       or receiver_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'COMMUNITY_EVENT_PARTICIPANTS', () => db.$executeRaw`
    delete from public.community_event_participants
    where profile_id in (select id from public.users where email like ${like})
       or community_event_id in (
         select id from public.community_events
         where creator_id in (select id from public.users where email like ${like})
       )
  `);

  await tryDelete(db, 'COMMUNITY_EVENTS', () => db.$executeRaw`
    delete from public.community_events
    where creator_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'HISTORICAL_SALES_METRICS', () => db.$executeRaw`
    delete from public.historical_sales_metrics
    where vendor_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'POS_INTEGRATIONS', () => db.$executeRaw`
    delete from public.pos_integrations
    where vendor_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'PRODUCT_EVENT_AVAILABILITY', () => db.$executeRaw`
    delete from public.product_event_availability
    where product_id in (
      select p.id from public.products p
      join public.vendors v on v.id = p.vendor_id
      join public.users u on u.id = v.user_id
      where u.email like ${like}
    )
  `);

  await tryDelete(db, 'PRODUCTS', () => db.$executeRaw`
    delete from public.products
    where vendor_id in (
      select v.id from public.vendors v
      join public.users u on u.id = v.user_id
      where u.email like ${like}
    )
  `);

  await tryDelete(db, 'VENDORS', () => db.$executeRaw`
    delete from public.vendors
    where user_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'FARMERS', () => db.$executeRaw`
    delete from public.farmers
    where user_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'SHOPPERS', () => db.$executeRaw`
    delete from public.shoppers
    where user_id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'PROFILES', () => db.$executeRaw`
    delete from public.profiles
    where id in (select id from public.users where email like ${like})
  `);

  await tryDelete(db, 'USERS', () => db.$executeRaw`
    delete from public.users
    where email like ${like}
  `);

  await tryDelete(db, 'AUTH_USERS', () => db.$executeRaw`
    delete from auth.users
    where email like ${like}
  `);
}

export async function runLocalNetworkSeed(db: SeedDb): Promise<LocalNetworkSeedResult> {
  await cleanNetworkSeed(db);

  const shopperIds: string[] = [];
  const vendorProfileIds: string[] = [];
  const farmerProfileIds: string[] = [];
  const vendorRowIds: string[] = [];
  let listings = 0;
  let posLinks = 0;

  // ---- Shoppers ----
  for (let i = 1; i <= SHOPPER_COUNT; i += 1) {
    const id = seedUserId('shopper', i);
    const email = seedEmail('shopper', i);
    const zip = DENVER_ZIPS[(i - 1) % DENVER_ZIPS.length]!;
    const interests = pickInterests(i);
    shopperIds.push(id);

    await ensureAuthUser(db, id, email);
    await db.$executeRaw`
      update public.users
      set
        role = 'shopper',
        name = ${`SEED SHOPPER ${String(i).padStart(2, '0')}`},
        email = ${email},
        city = 'Denver',
        state = 'CO',
        zip_code = ${zip},
        shopper_interests = ${pgTextArray(interests)}::text[],
        shopper_zip_code = ${zip},
        updated_at = now()
      where id = ${id}::uuid
    `;
    await db.$executeRaw`
      insert into public.profiles (
        id, role, shopper_interests, shopper_zip_code, vendor_specialties, farmer_specialties
      ) values (
        ${id}::uuid,
        'shopper'::public.profile_role,
        ${pgTextArray(interests)}::text[],
        ${zip},
        '{}'::text[],
        '{}'::text[]
      )
      on conflict (id) do update set
        role = excluded.role,
        shopper_interests = excluded.shopper_interests,
        shopper_zip_code = excluded.shopper_zip_code,
        updated_at = now()
    `;
  }

  // ---- Vendors ----
  for (let i = 1; i <= VENDOR_COUNT; i += 1) {
    const id = seedUserId('vendor', i);
    const vendorRowId = seedEntityId('vendor', i);
    const email = seedEmail('vendor', i);
    const specialty = VENDOR_SPECIALTIES[(i - 1) % VENDOR_SPECIALTIES.length]!;
    const zip = DENVER_ZIPS[(i + 3) % DENVER_ZIPS.length]!;
    const { lat, lng } = offsetCoord(i);
    const name = `SEED ${specialty.replace(/_/g, ' ')} ${String(i).padStart(2, '0')}`;
    const description =
      `Denver metro ${specialty.replace(/_/g, ' ').toLowerCase()} booth with seasonal inventory and booth retail.`;
    vendorProfileIds.push(id);
    vendorRowIds.push(vendorRowId);

    await ensureAuthUser(db, id, email);
    await db.$executeRaw`
      update public.users
      set
        role = 'vendor',
        name = ${name},
        email = ${email},
        city = 'Denver',
        state = 'CO',
        zip_code = ${zip},
        vendor_specialties = ${pgTextArray([specialty])}::text[],
        updated_at = now()
      where id = ${id}::uuid
    `;
    await db.$executeRaw`
      insert into public.profiles (
        id, role, shopper_interests, shopper_zip_code, vendor_specialties, farmer_specialties
      ) values (
        ${id}::uuid,
        'vendor'::public.profile_role,
        '{}'::text[],
        ${zip},
        ${pgTextArray([specialty])}::text[],
        '{}'::text[]
      )
      on conflict (id) do update set
        role = excluded.role,
        vendor_specialties = excluded.vendor_specialties,
        shopper_zip_code = excluded.shopper_zip_code,
        updated_at = now()
    `;
    await db.$executeRaw`
      insert into public.vendors (
        id, user_id, business_name, business_description, category,
        sell_city, sell_state, postal_code, latitude, longitude,
        approval_status, product_summary
      ) values (
        ${vendorRowId}::uuid,
        ${id}::uuid,
        ${name},
        ${description},
        ${specialty},
        'Denver',
        'CO',
        ${zip},
        ${lat},
        ${lng},
        'approved',
        ${`${specialty} MARKET LISTINGS`}
      )
      on conflict (user_id) do update set
        business_name = excluded.business_name,
        business_description = excluded.business_description,
        category = excluded.category,
        sell_city = excluded.sell_city,
        sell_state = excluded.sell_state,
        postal_code = excluded.postal_code,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        approval_status = 'approved',
        product_summary = excluded.product_summary,
        updated_at = now()
    `;

    // Resolve actual vendor row id (trigger may have created a different id)
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      select id from public.vendors where user_id = ${id}::uuid limit 1
    `;
    const resolvedVendorId = rows[0]?.id ?? vendorRowId;
    vendorRowIds[i - 1] = resolvedVendorId;

    // 10 vendors get 3 listings, 5 get 2 → 40 total across the vendor cluster
    const productCount = i <= 10 ? 3 : 2;
    for (let p = 0; p < productCount; p += 1) {
      const productId = seedEntityId('product', i * 10 + p);
      const productName = `${specialty.replace(/_/g, ' ')} LISTING ${p + 1}`;
      const price = 500 + ((i * 17 + p * 41) % 4500);
      await db.$executeRaw`
        insert into public.products (
          id, vendor_id, name, description, price, category, status, sku, stock
        ) values (
          ${productId}::uuid,
          ${resolvedVendorId}::uuid,
          ${productName},
          ${`Seed inventory for ${name}.`},
          ${price},
          ${specialty},
          'active',
          ${`SEED-V-${i}-${p + 1}`},
          25
        )
        on conflict (id) do update set
          name = excluded.name,
          description = excluded.description,
          price = excluded.price,
          status = 'active',
          stock = greatest(public.products.stock, 25),
          updated_at = now()
      `;
      listings += 1;
    }

    // Mock POS link state on pos_integrations (profile id = vendor_id)
    const providers = ['SQUARE', 'TOAST', 'STRIPE_NATIVE'] as const;
    const provider = providers[(i - 1) % providers.length]!;
    const connected = i % 3 !== 0;
    try {
      await db.$executeRaw`
        insert into public.pos_integrations (
          vendor_id, provider, credentials_connected, last_sync_at
        ) values (
          ${id}::uuid,
          ${provider}::public.pos_analytics_provider,
          ${connected},
          ${connected ? new Date().toISOString() : null}::timestamptz
        )
        on conflict (vendor_id, provider) do update set
          credentials_connected = excluded.credentials_connected,
          last_sync_at = excluded.last_sync_at,
          updated_at = now()
      `;
      posLinks += 1;
    } catch {
      // Table may be absent in older local DBs — skip quietly.
    }
  }

  // ---- Farmers ----
  for (let i = 1; i <= FARMER_COUNT; i += 1) {
    const id = seedUserId('farmer', i);
    const farmerRowId = seedEntityId('farmer', i);
    const email = seedEmail('farmer', i);
    const specialty = FARMER_SPECIALTIES[(i - 1) % FARMER_SPECIALTIES.length]!;
    const zip = DENVER_ZIPS[(i + 7) % DENVER_ZIPS.length]!;
    const { lat, lng } = offsetCoord(i + 40);
    const name = `SEED ${specialty.replace(/_/g, ' ')} FARM ${String(i).padStart(2, '0')}`;
    const bulkCase = `${specialty.replace(/_/g, ' ')} BULK CASE`;
    const bulkPrice = (25 + ((i * 23) % 80)).toFixed(2);
    const description =
      `Front Range ${specialty.replace(/_/g, ' ').toLowerCase()} farm. Wholesale: ${bulkCase} at $${bulkPrice} per case for local vendor sourcing.`;
    farmerProfileIds.push(id);

    await ensureAuthUser(db, id, email);
    await db.$executeRaw`
      update public.users
      set
        role = 'farmer',
        name = ${name},
        email = ${email},
        city = 'Denver',
        state = 'CO',
        zip_code = ${zip},
        farmer_specialties = ${pgTextArray([specialty])}::text[],
        updated_at = now()
      where id = ${id}::uuid
    `;
    await db.$executeRaw`
      insert into public.profiles (
        id, role, shopper_interests, shopper_zip_code, vendor_specialties, farmer_specialties
      ) values (
        ${id}::uuid,
        'farmer'::public.profile_role,
        '{}'::text[],
        ${zip},
        '{}'::text[],
        ${pgTextArray([specialty])}::text[]
      )
      on conflict (id) do update set
        role = excluded.role,
        farmer_specialties = excluded.farmer_specialties,
        shopper_zip_code = excluded.shopper_zip_code,
        updated_at = now()
    `;
    await db.$executeRaw`
      insert into public.farmers (
        id, user_id, farm_name, farm_description,
        sell_city, sell_state, postal_code, latitude, longitude, approval_status
      ) values (
        ${farmerRowId}::uuid,
        ${id}::uuid,
        ${name},
        ${description},
        'Denver',
        'CO',
        ${zip},
        ${lat},
        ${lng},
        'approved'
      )
      on conflict (user_id) do update set
        farm_name = excluded.farm_name,
        farm_description = excluded.farm_description,
        sell_city = excluded.sell_city,
        sell_state = excluded.sell_state,
        postal_code = excluded.postal_code,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        approval_status = 'approved',
        updated_at = now()
    `;
  }

  // ---- B2B connections (10 pairs, mix pending/connected) ----
  // Disable thread-open trigger: live DBs may lack a compatible
  // conversation_threads.b2b_peer_user_id insert path during bulk seed.
  await tryDelete(db, 'DISABLE_CONN_THREAD_TRIGGER', () =>
    db.$executeRawUnsafe(
      'alter table public.vendor_connections disable trigger vendor_connections_open_thread',
    ),
  );

  const b2bPool = [...vendorProfileIds, ...farmerProfileIds];
  let connections = 0;
  const usedPairs = new Set<string>();
  let connSlot = 1;
  for (let s = 0; s < b2bPool.length && connections < CONNECTION_COUNT; s += 1) {
    for (let r = s + 1; r < b2bPool.length && connections < CONNECTION_COUNT; r += 1) {
      const sender = b2bPool[s]!;
      const receiver = b2bPool[r]!;
      const pairKey = `${sender}:${receiver}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);
      const status = connections % 2 === 0 ? 'pending' : 'connected';
      const connId = seedEntityId('conn', connSlot);
      connSlot += 1;
      await db.$executeRaw`
        insert into public.vendor_connections (
          id, sender_id, receiver_id, status
        ) values (
          ${connId}::uuid,
          ${sender}::uuid,
          ${receiver}::uuid,
          ${status}::public.vendor_connection_status
        )
        on conflict do nothing
      `;
      connections += 1;
    }
  }

  await tryDelete(db, 'ENABLE_CONN_THREAD_TRIGGER', () =>
    db.$executeRawUnsafe(
      'alter table public.vendor_connections enable trigger vendor_connections_open_thread',
    ),
  );

  // ---- Follows (30) ----
  const followTargets = [...vendorProfileIds, ...farmerProfileIds];
  let follows = 0;
  const usedFollows = new Set<string>();
  let followSlot = 1;
  for (let s = 0; s < shopperIds.length && follows < FOLLOW_COUNT; s += 1) {
    for (let t = 0; t < followTargets.length && follows < FOLLOW_COUNT; t += 1) {
      // Spread shoppers across vendors/farmers with a stride to avoid clustering.
      const target = followTargets[(s * 3 + t) % followTargets.length]!;
      const shopper = shopperIds[s]!;
      const key = `${shopper}:${target}`;
      if (usedFollows.has(key)) continue;
      usedFollows.add(key);
      const followId = seedEntityId('follow', followSlot);
      followSlot += 1;
      await db.$executeRaw`
        insert into public.follows (id, shopper_id, followed_profile_id)
        values (${followId}::uuid, ${shopper}::uuid, ${target}::uuid)
        on conflict (shopper_id, followed_profile_id) do nothing
      `;
      follows += 1;
    }
  }

  return {
    profiles: SHOPPER_COUNT + VENDOR_COUNT + FARMER_COUNT,
    shoppers: SHOPPER_COUNT,
    vendors: VENDOR_COUNT,
    farmers: FARMER_COUNT,
    listings,
    connections,
    follows,
    posLinks,
  };
}

export function formatSeedSummary(result: LocalNetworkSeedResult): string {
  return [
    'SEED COMPLETE:',
    `${result.profiles} PROFILES`,
    `${result.shoppers} SHOPPERS`,
    `${result.vendors} VENDORS`,
    `${result.farmers} FARMERS`,
    `${result.listings} LISTINGS`,
    `${result.connections} CONNECTIONS`,
    `${result.follows} FOLLOWS`,
    `${result.posLinks} POS LINKS`,
  ].join(' ');
}
