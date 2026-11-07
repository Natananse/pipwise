const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const placeholder = 'TEST_PASSWORD_PLACEHOLDER';
const valid = `postgresql://app_runtime:${placeholder}@test-pooler.example.test/neondb?sslmode=require&channel_binding=require`;

function load(env = {}) {
  const module = { exports: {} };
  const connections = [];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/database.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, URL, Set, process: { env },
    require(name) {
      assert.equal(name, '@neondatabase/serverless');
      return { neon(connection) { connections.push(connection); return { testClient: true }; } };
    },
  });
  return { ...module.exports, connections };
}

test('runtime uses only its dedicated credential and accepts the expected restricted login', () => {
  const h = load({ APP_RUNTIME_DATABASE_URL: ` ${valid} `, DATABASE_URL: 'OWNER_PLACEHOLDER' });
  assert.equal(h.runtimeConnectionString(), valid);
  assert.equal(h.runtimeDatabase().testClient, true);
  assert.deepEqual(h.connections, [valid]);
});

test('owner, migration and retention credentials fail closed without leaking values', () => {
  const h = load();
  for (const value of [
    '', 'INVALID_CONNECTION_PLACEHOLDER',
    valid.replace('app_runtime:', 'neondb_owner:'),
    valid.replace('app_runtime:', 'migrator:'),
    valid.replace('app_runtime:', 'retention_job:'),
    valid.replace(`:${placeholder}@`, '@'),
    valid.replace('postgresql:', 'https:'),
    valid.replace('/neondb?', '/?'),
    valid.replace('test-pooler.example.test', '127.0.0.1'),
    valid.replace('test-pooler.example.test', 'localhost'),
    `${valid}#fragment`,
  ]) {
    assert.throws(() => h.runtimeConnectionString({ APP_RUNTIME_DATABASE_URL: value }), error => {
      assert.equal(error.name, 'DatabaseConfigurationError');
      assert(!error.message.includes(placeholder));
      assert(!error.message.includes('://'));
      return true;
    });
  }
  assert.throws(() => h.runtimeDatabase({ DATABASE_URL: valid }));
  assert.equal(h.connections.length, 0);
});

test('URL parameters cannot override the restricted identity, destination, or TLS policy', () => {
  const h = load();
  for (const parameter of [
    'user=neondb_owner', 'password=OVERRIDE_PLACEHOLDER', 'host=other.example.test',
    'dbname=other', 'options=-c%20role%3Dneondb_owner', 'sslmode=disable',
    'sslmode=prefer', 'sslmode=require&sslmode=disable', 'channel_binding=disable',
    'connect_timeout=0', 'connect_timeout=301', 'unknown=anything',
  ]) {
    const value = valid.split('?')[0] + '?' + parameter;
    assert.throws(() => h.runtimeConnectionString({ APP_RUNTIME_DATABASE_URL: value }));
  }
  assert.equal(h.runtimeConnectionString({ APP_RUNTIME_DATABASE_URL: valid + '&connect_timeout=15' }), valid + '&connect_timeout=15');
  assert.equal(h.connections.length, 0);
});

test('mobile modules never import the database driver or server modules', () => {
  for (const directory of ['src/lib', 'src/components', 'src/app']) {
    for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.[jt]sx?$/.test(entry.name)) continue;
      const path = require('node:path').join(entry.parentPath, entry.name);
      if (path.includes('/api/') || entry.name.endsWith('+api.ts')) continue;
      const source = fs.readFileSync(path, 'utf8');
      assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"][^'"]*(?:server\/|@neondatabase\/serverless)/, path);
      assert.doesNotMatch(source, /process\.env\.(?:APP_RUNTIME_DATABASE_URL|MIGRATOR_DATABASE_URL|RETENTION_JOB_DATABASE_URL|DATABASE_URL)/, path);
    }
  }
});
