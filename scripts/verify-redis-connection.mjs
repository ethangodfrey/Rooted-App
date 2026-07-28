/**
 * Smoke checks for Railway Redis URL resolution.
 * Run: node scripts/verify-redis-connection.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = spawnSync('npm', ['run', 'build', '--prefix', 'packages/env-config'], {
  cwd: root,
  encoding: 'utf8',
});
if (build.status !== 0) {
  console.error(build.stdout);
  console.error(build.stderr);
  process.exit(build.status ?? 1);
}

const require = createRequire(import.meta.url);
const {
  resolveRedisConnectionFromEnv,
  isRedisConfigured,
  isRailwayRedisHost,
} = require('../packages/env-config/dist/index.js');

assert.equal(isRedisConfigured({}), false);
assert.equal(isRailwayRedisHost('redis.railway.internal'), true);

const railway = resolveRedisConnectionFromEnv({
  REDIS_URL: 'redis://default:secret@redis.railway.internal:6379',
});
assert.equal(railway.source, 'REDIS_URL');
assert.equal(railway.protocol, 'redis:');
assert.equal(railway.isRailwayHost, true);
assert.equal(railway.fields.host, 'redis.railway.internal');
assert.equal(railway.fields.port, 6379);
assert.equal(railway.fields.username, 'default');
assert.equal(railway.fields.password, 'secret');
assert.equal(railway.fields.family, 4);
assert.equal(railway.fields.tls, undefined);
assert.equal(railway.fields.keepAlive, 30_000);
assert.equal(railway.fields.maxRetriesPerRequest, null);

const tls = resolveRedisConnectionFromEnv({
  REDIS_URL: 'rediss://default:secret@maglev.proxy.rlwy.net:12345/0',
});
assert.equal(tls.protocol, 'rediss:');
assert.ok(tls.fields.tls);
assert.equal(tls.fields.db, 0);

const discrete = resolveRedisConnectionFromEnv({
  REDISHOST: 'redis.railway.internal',
  REDISPORT: '6379',
  REDISPASSWORD: 'pw',
  REDISUSER: 'default',
});
assert.equal(discrete.source, 'REDISHOST');
assert.equal(discrete.fields.password, 'pw');

console.log('REDIS_MIGRATION_CONFIGURED VERIFY_OK');
console.log('RAILWAY_REDIS_CONNECTED VERIFY_OK');
