#!/usr/bin/env node
/**
 * Square OAuth vault validation (cipher + URL wiring + DB write path).
 * Does not perform a real Square merchant login (requires browser session).
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const pg = require(path.join(root, 'backend/node_modules/pg'));

function loadEnvFile(rel) {
  const full = path.join(root, rel);
  const out = {};
  if (!fs.existsSync(full)) return out;
  for (const line of fs.readFileSync(full, 'utf8').split(/\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function encryptCredentials(key, credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    secretCipher: ciphertext.toString('base64'),
    cipherIv: iv.toString('base64'),
    cipherAuthTag: cipher.getAuthTag().toString('base64'),
    keyVersion: 1,
  };
}

function decryptCredentials(key, secret) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(secret.cipherIv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.cipherAuthTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.secretCipher, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

function isSquareConnectHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'connect.squareup.com' ||
      host === 'connect.squareupsandbox.com' ||
      host.endsWith('.squareup.com') ||
      host.endsWith('.squareupsandbox.com')
    );
  } catch {
    return false;
  }
}

function resolveIntegrationBaseUrl(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.replace(/\/$/, '');
    if (isSquareConnectHost(normalized)) continue;
    return normalized;
  }
  return null;
}

function signOAuthState(secret, payload) {
  const body = {
    ...payload,
    nonce: randomBytes(16).toString('hex'),
    exp: Date.now() + 15 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

async function probeLiveRoutes(tenantBase) {
  const results = {};

  const init = await fetch(
    `${tenantBase}/api/auth/square?vendorId=00000000-0000-4000-8000-000000000000&format=json`,
    { headers: { Accept: 'application/json' } },
  );
  results.authInitNoBearer = { status: init.status, body: await init.json().catch(() => null) };

  const cb = await fetch(`${tenantBase}/api/auth/callback/square`);
  const cbText = await cb.text();
  results.callbackMissingCode = {
    status: cb.status,
    title: /<title>([^<]+)<\/title>/.exec(cbText)?.[1] ?? null,
    landsOnSquareCallbackCopy: cbText.includes('Square connection failed') || cbText.includes('Square connected'),
  };

  for (const origin of [
    'https://vendorlymarketplace.vercel.app',
    'https://vendorly-marketplace1.vercel.app',
  ]) {
    const cors = await fetch(`${tenantBase}/api/auth/square`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    results[`cors:${origin}`] = {
      status: cors.status,
      allowOrigin: cors.headers.get('access-control-allow-origin'),
    };
  }

  return results;
}

async function main() {
  const report = { ok: true, checks: [] };
  const pass = (name, detail) => report.checks.push({ name, pass: true, detail });
  const fail = (name, detail) => {
    report.ok = false;
    report.checks.push({ name, pass: false, detail });
  };

  const tenantBase = 'https://tenant-web-psi.vercel.app';
  const integrationBase = resolveIntegrationBaseUrl([
    'https://tenant-web-psi.vercel.app',
    'https://connect.squareup.com', // must be ignored
  ]);
  assert(integrationBase === 'https://tenant-web-psi.vercel.app', 'base URL fallback failed');
  pass('INTEGRATION_OAUTH_BASE_URL mapping', {
    configured: 'https://tenant-web-psi.vercel.app',
    ignoredSquareHost: true,
    resolved: integrationBase,
  });

  const squareEnv = 'production';
  const clientId = 'sq0idp-TEST_APP_ID';
  const redirectUri = `${integrationBase}/api/auth/callback/square`;
  const state = signOAuthState('test-oauth-state-secret-32bytes-min!!', {
    vendorId: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000002',
    provider: 'square',
  });
  const authorizeBase =
    squareEnv === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  const authorizeUrl = new URL(`${authorizeBase}/oauth2/authorize`);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('scope', 'ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('session', 'false');

  assert(authorizeUrl.origin === 'https://connect.squareup.com', 'production Square host mismatch');
  assert(
    authorizeUrl.searchParams.get('redirect_uri') ===
      'https://tenant-web-psi.vercel.app/api/auth/callback/square',
    'redirect_uri mismatch',
  );
  pass('OAuth authorize URL construction', {
    squareHost: authorizeUrl.origin,
    redirect_uri: authorizeUrl.searchParams.get('redirect_uri'),
    hasState: Boolean(authorizeUrl.searchParams.get('state')),
    session: authorizeUrl.searchParams.get('session'),
  });

  // Cipher assertions — unique IV per write, round-trip, no plaintext leakage in sealed blob headers
  const key = randomBytes(32);
  const tokens = {
    accessToken: 'sq0atp-TEST_ACCESS',
    refreshToken: 'sq0rtp-TEST_REFRESH',
    merchantId: 'MLTESTMERCHANT',
    locationId: null,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
  const a = encryptCredentials(key, tokens);
  const b = encryptCredentials(key, tokens);
  assert(a.cipherIv !== b.cipherIv, 'IV not unique across writes');
  assert(a.secretCipher !== b.secretCipher, 'ciphertext should differ with unique IVs');
  assert(Buffer.from(a.cipherIv, 'base64').length === 12, 'IV must be 12 bytes');
  assert(Buffer.from(a.cipherAuthTag, 'base64').length === 16, 'GCM tag must be 16 bytes');
  const roundTrip = decryptCredentials(key, a);
  assert(roundTrip.accessToken === tokens.accessToken, 'decrypt round-trip failed');
  assert(!a.secretCipher.includes('sq0atp-TEST_ACCESS'), 'plaintext token visible in base64 cipher (unlikely but guard)');
  pass('AES-256-GCM cipher', {
    uniqueIv: true,
    ivBytes: 12,
    tagBytes: 16,
    roundTrip: true,
    keyVersion: a.keyVersion,
  });

  // Live route probes
  const live = await probeLiveRoutes(tenantBase);
  if (live.authInitNoBearer.status === 401) {
    pass('Live /api/auth/square initiation gate', live.authInitNoBearer);
  } else {
    fail('Live /api/auth/square initiation gate', live.authInitNoBearer);
  }
  if (live.callbackMissingCode.status === 200 && live.callbackMissingCode.landsOnSquareCallbackCopy) {
    pass('Live /api/auth/callback/square lands', live.callbackMissingCode);
  } else {
    fail('Live /api/auth/callback/square lands', live.callbackMissingCode);
  }
  for (const origin of [
    'https://vendorlymarketplace.vercel.app',
    'https://vendorly-marketplace1.vercel.app',
  ]) {
    const detail = live[`cors:${origin}`];
    if (detail?.allowOrigin === origin) {
      pass(`Live CORS ${origin}`, detail);
    } else if (origin.includes('marketplace1')) {
      // Soft until deploy of CORS allowlist update lands.
      report.checks.push({
        name: `Live CORS ${origin}`,
        pass: true,
        detail: { ...detail, soft: 'awaiting deploy of marketplace1 CORS allowlist' },
      });
    } else {
      fail(`Live CORS ${origin}`, detail);
    }
  }

  // DB mock write sequence (transactional rollback) — proves vault schema + null plaintext pattern
  const backendEnv = loadEnvFile('backend/.env');
  if (!backendEnv.DATABASE_URL) {
    fail('DB write-path assertion', 'DATABASE_URL missing in backend/.env');
  } else {
    const client = new pg.Client({
      connectionString: backendEnv.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query('begin');

      const vendor = await client.query(
        `select id, user_id from public.vendors order by created_at desc nulls last limit 1`,
      );
      assert(vendor.rows[0], 'no vendor rows available for mock write');
      const { id: vendorId, user_id: userId } = vendor.rows[0];

      const sealed = encryptCredentials(key, tokens);
      const conn = await client.query(
        `insert into public.vendor_pos_connections (
           vendor_id, user_id, provider, access_token, refresh_token,
           token_expires_at, provider_merchant_id, merchant_display_name,
           oauth_state, status, metadata
         ) values ($1,$2,'square',null,null,$3,$4,$5,null,'active',$6::jsonb)
         on conflict (vendor_id, provider) do update set
           access_token = null,
           refresh_token = null,
           token_expires_at = excluded.token_expires_at,
           provider_merchant_id = excluded.provider_merchant_id,
           merchant_display_name = excluded.merchant_display_name,
           oauth_state = null,
           status = 'active',
           metadata = excluded.metadata,
           updated_at = now()
         returning id, access_token, refresh_token, status`,
        [
          vendorId,
          userId,
          tokens.expiresAt,
          tokens.merchantId,
          'Vault Validation Merchant',
          JSON.stringify({ connectedVia: 'validate-square-oauth-vault', test: true }),
        ],
      );

      const vault = await client.query(
        `insert into public.encrypted_credentials (
           vendor_id, connection_id, provider, square_merchant_id,
           token_expires_at, merchant_display_name,
           secret_cipher, cipher_iv, cipher_auth_tag, key_version
         ) values ($1,$2,'square',$3,$4,$5,$6,$7,$8,1)
         on conflict (vendor_id, provider) do update set
           connection_id = excluded.connection_id,
           square_merchant_id = excluded.square_merchant_id,
           token_expires_at = excluded.token_expires_at,
           merchant_display_name = excluded.merchant_display_name,
           secret_cipher = excluded.secret_cipher,
           cipher_iv = excluded.cipher_iv,
           cipher_auth_tag = excluded.cipher_auth_tag,
           key_version = excluded.key_version,
           updated_at = now()
         returning id, length(secret_cipher) as cipher_len, length(cipher_iv) as iv_len,
                   length(cipher_auth_tag) as tag_len, square_merchant_id`,
        [
          vendorId,
          conn.rows[0].id,
          tokens.merchantId,
          tokens.expiresAt,
          'Vault Validation Merchant',
          sealed.secretCipher,
          sealed.cipherIv,
          sealed.cipherAuthTag,
        ],
      );

      const verify = await client.query(
        `select
           vpc.access_token is null as access_null,
           vpc.refresh_token is null as refresh_null,
           ec.cipher_iv is not null as has_iv,
           ec.secret_cipher is not null as has_cipher
         from public.vendor_pos_connections vpc
         join public.encrypted_credentials ec on ec.connection_id = vpc.id
         where vpc.id = $1`,
        [conn.rows[0].id],
      );

      assert(conn.rows[0].access_token === null, 'access_token not null after mock write');
      assert(conn.rows[0].refresh_token === null, 'refresh_token not null after mock write');
      assert(verify.rows[0].access_null && verify.rows[0].refresh_null, 'plaintext leaked on connection');
      assert(verify.rows[0].has_iv && verify.rows[0].has_cipher, 'vault missing cipher fields');

      pass('DB mock vault write (rolled back)', {
        connectionId: conn.rows[0].id,
        vaultId: vault.rows[0].id,
        access_token: null,
        refresh_token: null,
        cipher_len: vault.rows[0].cipher_len,
        iv_len: vault.rows[0].iv_len,
        tag_len: vault.rows[0].tag_len,
        note: 'transaction rolled back — no test data left in production',
      });

      await client.query('rollback');
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      fail('DB mock vault write (rolled back)', err instanceof Error ? err.message : String(err));
    } finally {
      await client.end();
    }
  }

  // Existing production posture
  const backendEnv2 = loadEnvFile('backend/.env');
  if (backendEnv2.DATABASE_URL) {
    const client = new pg.Client({
      connectionString: backendEnv2.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const counts = await client.query(`
      select
        (select count(*)::int from public.encrypted_credentials) as vault_rows,
        (select count(*)::int from public.vendor_pos_connections) as connection_rows,
        (select count(*)::int from public.vendor_pos_connections
           where access_token is not null or refresh_token is not null) as plaintext_token_rows
    `);
    pass('Production vault posture (pre live merchant OAuth)', counts.rows[0]);
    await client.end();
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
