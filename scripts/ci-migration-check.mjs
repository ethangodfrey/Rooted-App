/**
 * CI localized migration / mock-schema check.
 * Validates Supabase migration catalog integrity and optionally probes Postgres.
 *
 * Usage:
 *   node scripts/ci-migration-check.mjs
 *   DATABASE_URL=postgresql://... node scripts/ci-migration-check.mjs
 *
 * Exit 0 on PASS, 1 on FAIL. Uppercase text-only logging (no emoji).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';

const MIG_DIR = resolve(process.cwd(), 'docs/supabase/migrations');
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

function log(message) {
  console.log(message);
}

function fail(message) {
  log(`FAIL: ${message}`);
  process.exit(1);
}

function listMigrations() {
  let entries;
  try {
    entries = readdirSync(MIG_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();
  } catch (err) {
    fail(`MIGRATION_DIR_UNREADABLE: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (entries.length === 0) {
    fail('NO_MIGRATION_FILES_FOUND');
  }
  return entries;
}

function validateMigrationFile(name) {
  const full = join(MIG_DIR, name);
  const st = statSync(full);
  if (!st.isFile() || st.size < 32) {
    fail(`MIGRATION_FILE_TOO_SMALL: ${name}`);
  }
  const body = readFileSync(full, 'utf8');
  if (EMOJI_RE.test(body)) {
    fail(`MIGRATION_CONTAINS_EMOJI: ${name}`);
  }
  if (!/create|alter|comment|grant|revoke/i.test(body)) {
    fail(`MIGRATION_MISSING_DDL_KEYWORDS: ${name}`);
  }
  if (!/^\d{8}_/.test(name)) {
    fail(`MIGRATION_NAME_DATE_PREFIX_INVALID: ${name}`);
  }
}

function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database: (parsed.pathname || '/').replace(/^\//, '') || 'postgres',
    };
  } catch {
    fail('DATABASE_URL_INVALID');
  }
}

function waitForPort(host, port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolveWait, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolveWait();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`PORT_TIMEOUT ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

function runPsql(databaseUrl, sql) {
  const result = spawnSync(
    'psql',
    [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8' },
  );
  if (result.error) {
    fail(`PSQL_UNAVAILABLE: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      `PSQL_FAILED: ${(result.stderr || result.stdout || 'UNKNOWN').trim()}`,
    );
  }
}

async function probePostgres(databaseUrl) {
  const cfg = parseDatabaseUrl(databaseUrl);
  log(`PROBE: POSTGRES ${cfg.host}:${cfg.port}/${cfg.database}`);
  await waitForPort(cfg.host, cfg.port);
  runPsql(databaseUrl, 'SELECT 1 AS ci_migration_probe;');
  runPsql(
    databaseUrl,
    "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS postgis;",
  );
  runPsql(
    databaseUrl,
    "SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','postgis') ORDER BY 1;",
  );
  log('PASS: POSTGRES SERVICE CONTAINER READY');
}

async function main() {
  log('RUNNING DATABASE MIGRATION CHECK');
  const files = listMigrations();
  log(`CATALOG: ${files.length} MIGRATION FILES`);
  for (const name of files) {
    validateMigrationFile(name);
    log(`CHECKED: ${name}`);
  }
  log('PASS: MIGRATION CATALOG VALID');

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    await probePostgres(databaseUrl);
  } else {
    log('SKIP: POSTGRES PROBE - DATABASE_URL NOT SET');
  }

  log('PASS: DATABASE MIGRATION CHECK COMPLETE');
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
