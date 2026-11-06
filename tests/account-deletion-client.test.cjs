const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ platform = 'android', env = { EXPO_PUBLIC_APP_API_URL: 'https://app.example.test' }, response = { ok: true, json: async () => ({ deleted: true }) }, storageFailure = false } = {}) {
  const events = [];
  const listeners = new Set();
  let currentRequest;
  let locked = false;
  const removeBehavior = { before: null };
  const imports = {
    'react-native': { Platform: { OS: platform } },
    '@react-native-async-storage/async-storage': {
      getAllKeys: async () => ['pipswise.workspace.v1', 'pipwise-moving-demo-v1', 'pipwise.invite.code.v1', 'pipwise.market.v1', 'demo', 'onboarded', 'theme', 'unrelated.library'],
      multiRemove: async keys => { events.push(['removed', ...keys]); await removeBehavior.before?.(); if (storageFailure) throw new Error('Storage unavailable'); },
    },
    './accountDetails': { clearRegistrationAfterAccountDeletion: async () => events.push('registration cleared') },
    './neonAuth': {
      clearAuthAfterAccountDeletion: async () => events.push('auth cleared'),
      lockAuthForAccountDeletion: () => { assert.equal(locked, false); locked = true; return () => { locked = false; }; },
      getAccountDeletionCredentials: async expected => { assert.equal(expected, 'account-a'); return { accountId: 'account-a', token: 'signed-jwt', sessionToken: 'session-proof' }; },
      subscribeAuth: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
    './persistence': { pausePersistenceForAccountDeletion: async () => events.push('old writes drained') },
    './demoMarket': { createDemoMarket: () => ({ serialize: () => 'empty demo' }), demoMarket: { restore: value => events.push(value) } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/accountDeletion.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, URL, Error, AbortController, setTimeout, clearTimeout, process: { env },
    fetch: async (url, options) => { currentRequest = { url, ...options }; return response; },
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return { ...module.exports, events, listeners, removeBehavior, locked: () => locked, request: () => currentRequest };
}

test('deletion client sends current bearer and session proof with confirmation, never an arbitrary account id', async () => {
  const h = harness();
  await h.requestAccountDeletion('account-a');
  const request = h.request();
  assert.equal(request.url, 'https://app.example.test/api/delete-account');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer signed-jwt');
  assert.equal(request.headers['X-Pipwise-Session'], 'session-proof');
  assert.deepEqual(JSON.parse(request.body), { confirmation: 'DELETE' });
  assert.equal(h.listeners.size, 0);
  assert.deepEqual(h.events, [], 'request success itself never silently erases local storage');
});

test('a failed deletion preserves local data and reports recent authentication requirement', async () => {
  const h = harness({ response: { ok: false, json: async () => ({ error: { code: 'REAUTHENTICATION_REQUIRED', message: 'Sign in again.' } }) } });
  await assert.rejects(h.requestAccountDeletion('account-a'), error => error.code === 'REAUTHENTICATION_REQUIRED');
  assert.deepEqual(h.events, []);
  assert.equal(h.listeners.size, 0);
});

test('local deletion drains old writes, clears secure identity/draft and only app-owned keys', async () => {
  const h = harness();
  await h.clearDeletedAccountLocalData();
  assert.equal(h.events[0], 'old writes drained');
  assert.equal(h.events[1], 'auth cleared');
  assert.equal(h.events[2], 'registration cleared');
  assert.deepEqual([...h.events[3]], ['removed', 'pipswise.workspace.v1', 'pipwise-moving-demo-v1', 'pipwise.invite.code.v1', 'pipwise.market.v1', 'demo', 'onboarded', 'theme']);
  assert.equal(h.events[4], 'empty demo');
});

test('failed local erase remains retryable and never reports a reset demo as completed', async () => {
  const h = harness({ storageFailure: true });
  await assert.rejects(h.clearDeletedAccountLocalData(), /Storage unavailable/);
  assert.ok(!h.events.includes('empty demo'));
});

test('native deletion rejects local and insecure service endpoints; web uses its same-origin API', () => {
  for (const url of ['http://app.example.test', 'https://127.0.0.1', 'https://192.168.1.1', 'https://localhost', 'https://user:secret@app.example.test']) {
    assert.throws(() => harness({ env: { EXPO_PUBLIC_APP_API_URL: url } }).accountDeletionEndpoint(), /unavailable/);
  }
  assert.equal(harness({ platform: 'web', env: {} }).accountDeletionEndpoint(), '/api/delete-account');
});

test('a confirmed deletion after an account switch reports the deleted account without erasing the new account', async () => {
  let finishResponse;
  const h = harness({ response: { ok: true, json: () => new Promise(resolve => { finishResponse = resolve; }) } });
  const request = h.requestAccountDeletion('account-a');
  await new Promise(resolve => setImmediate(resolve));
  h.listeners.forEach(listener => listener({ user: { id: 'account-b' } }));
  finishResponse({ deleted: true });
  await assert.rejects(request, error => error.code === 'DELETED_ACCOUNT_CHANGED' && error.deletedAccountId === 'account-a');
  assert.deepEqual(h.events, []);
});

test('overlapping UI retries share one physical erase and keep Auth locked until it finishes', async () => {
  const h = harness();
  let release;
  h.removeBehavior.before = () => new Promise(resolve => { release = resolve; });
  const first = h.clearDeletedAccountLocalData('account-a');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.locked(), true);
  const retry = h.clearDeletedAccountLocalData('account-a');
  assert.equal(first, retry);
  assert.equal(h.events.filter(event => Array.isArray(event) && event[0] === 'removed').length, 1);
  release();
  await Promise.all([first, retry]);
  assert.equal(h.locked(), false);
  assert.equal(h.events.filter(event => event === 'empty demo').length, 1);
});
