const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function harness(available = false) {
  const module = { exports: {} };
  const values = new Map();
  const calls = [];
  let imports = 0;
  const secureStore = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
    async getItemAsync(key) { calls.push(['get', key]); return values.get(key) ?? null; },
    async setItemAsync(key, value, options) { calls.push(['set', key, options.keychainAccessible]); values.set(key, value); },
    async deleteItemAsync(key) { calls.push(['delete', key]); values.delete(key); },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/secureStorage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, Error,
    require(name) {
      if (name === 'expo') return { requireOptionalNativeModule(moduleName) {
        assert.equal(moduleName, 'ExpoSecureStore');
        return available ? {} : null;
      } };
      if (name === 'expo-secure-store') {
        imports++;
        assert.equal(available, true, 'importing the missing native package would fatally crash Metro');
        return secureStore;
      }
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { ...module.exports, values, calls, imports: () => imports, setAvailable: value => { available = value; } };
}

test('missing native storage is detected before evaluating its package and exposes rebuild guidance', async () => {
  const h = harness();
  assert.equal(h.imports(), 0);
  await assert.rejects(h.loadSecureStore(), error => error instanceof h.SecureStorageUnavailableError
    && error.code === 'NATIVE_SECURE_STORAGE_UNAVAILABLE' && /Rebuild and install/.test(error.message)
    && /Reloading JavaScript alone cannot add/.test(error.message));
  assert.equal(h.imports(), 0);
  assert.equal(h.values.size, 0);
  assert.deepEqual(h.calls, []);
});

test('availability can be retried without a cached failure and encrypted storage API/options remain intact', async () => {
  const h = harness();
  await assert.rejects(h.loadSecureStore());
  h.setAvailable(true);
  const store = await h.loadSecureStore();
  const options = { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  await store.setItemAsync('session', 'opaque-test-session', options);
  assert.equal(await store.getItemAsync('session'), 'opaque-test-session');
  await store.deleteItemAsync('session');
  assert.equal(await store.getItemAsync('session'), null);
  assert.equal(h.imports(), 1);
  assert.deepEqual(h.calls, [['set', 'session', 'device-only'], ['get', 'session'], ['delete', 'session'], ['get', 'session']]);
});
