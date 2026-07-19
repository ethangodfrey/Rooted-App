/**
 * Safe prepare hook for file: installs.
 * When backend/tenant-web run `npm ci`, this package is packed before its own
 * node_modules exist — skip the compile and let explicit CI/build steps handle it.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

function canResolve(id) {
  try {
    require.resolve(id, { paths: [path.join(__dirname, '..')] });
    return true;
  } catch {
    return false;
  }
}

if (!canResolve('zod') || !canResolve('typescript')) {
  console.log('ENV_CONFIG_PREPARE_SKIPPED REASON=DEPS_UNAVAILABLE');
  process.exit(0);
}

execSync('npm run build', {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});
