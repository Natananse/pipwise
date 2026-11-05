const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, Error, URL, AbortController, setTimeout, clearTimeout, ...globals,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return module.exports;
}
const registration = load('src/lib/registrationDetails.ts');
const persistence = load('src/lib/persistence.ts');
const member = { user: { id: 'member-a', email: 'member@example.test' } };
const details = { countryCode: 'ET', phoneNumber: '+251912345678' };

function harness({ platform = 'android', storage = new Map() } = {}) {
  let currentSession = member;
  let now = 1800000000000;
  let token = async () => 'signed-token';
  let reply = async (_url, options) => ({ ok: true, status: 200, json: async () => ({ details: options.body ? JSON.parse(options.body) : details }) });
  const listeners = new Set();
  const requests = [];
  const api = load('src/lib/accountDetails.ts', {
    'react-native': { Platform: { OS: platform } },
    './registrationDetails': registration,
    './persistence': persistence,
    './secureStorage': { loadSecureStore: async () => ({ getItemAsync: async key => storage.get(key) || null, setItemAsync: async (key, value) => storage.set(key, value), deleteItemAsync: async key => storage.delete(key) }) },
    './startupTasks': { withStartupTimeout: promise => promise },
    './neonAuth': {
      getAuthSession: async () => currentSession, getAuthToken: () => token(),
      subscribeAuth: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
  }, {
    Date: { now: () => now },
    process: { env: { EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise.example/native-auth.html' } },
    fetch: async (url, options) => { requests.push({ url, options }); return reply(url, options); },
  });
  return { api, requests, storage, listeners, setToken: value => { token = value; }, setReply: value => { reply = value; }, advance: milliseconds => { now += milliseconds; }, emit(session) { currentSession = session; listeners.forEach(listener => listener(session)); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('account-details requests authenticate and never send a client-chosen account ID', async () => {
  const h = harness();
  await h.api.saveAccountDetails(details);
  assert.equal(h.requests[0].url, 'https://pipwise.example/api/account-details');
  assert.equal(h.requests[0].options.headers.Authorization, 'Bearer signed-token');
  assert.deepEqual(JSON.parse(h.requests[0].options.body), details);
  assert.equal(h.listeners.size, 0);
  const web = harness({ platform: 'web' });
  await web.api.getAccountDetails();
  assert.equal(web.requests[0].url, '/api/account-details');
});

test('native pending details survive the email-code step and flush only for the matching email', async () => {
  const h = harness();
  await h.api.stageRegistrationDetails(' MEMBER@Example.test ', details);
  assert.equal(h.storage.size, 1);
  const restarted = harness({ storage: h.storage });
  await restarted.api.syncPendingRegistrationDetails(member);
  assert.equal(restarted.requests.length, 1);
  assert.deepEqual(JSON.parse(restarted.requests[0].options.body), details);
  assert.equal(restarted.storage.size, 0);

  await h.api.stageRegistrationDetails(member.user.email, details);
  const other = { user: { id: 'member-b', email: 'other@example.test' } };
  h.emit(other);
  await h.api.syncPendingRegistrationDetails(other);
  assert.equal(h.requests.length, 0, 'a different account must never receive the draft');
  assert.equal(h.storage.size, 0);
});

test('pending details retain a failed authenticated save for retry and expire after thirty minutes', async () => {
  const h = harness();
  await h.api.stageRegistrationDetails(member.user.email, details);
  h.setReply(async () => ({ ok: false, status: 503, json: async () => ({ error: 'private server diagnostic' }) }));
  await assert.rejects(h.api.syncPendingRegistrationDetails(member), /Could not save or load/);
  assert.equal(h.storage.size, 1);
  h.setReply(async () => ({ ok: true, status: 200, json: async () => ({ details }) }));
  await h.api.syncPendingRegistrationDetails(member);
  assert.equal(h.storage.size, 0);
  await h.api.stageRegistrationDetails(member.user.email, details);
  h.advance(31 * 60000);
  const before = h.requests.length;
  await h.api.syncPendingRegistrationDetails(member);
  assert.equal(h.requests.length, before);
  assert.equal(h.storage.size, 0);
});

test('changing accounts while acquiring a token prevents a previous account draft from being sent', async () => {
  const h = harness();
  let release;
  h.setToken(() => new Promise(resolve => { release = resolve; }));
  const save = h.api.saveAccountDetails(details);
  await flush();
  h.emit({ user: { id: 'member-b', email: 'other@example.test' } });
  release('another-account-token');
  await assert.rejects(save, /account changed/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.listeners.size, 0);
});

test('malformed stored or server details cannot become an account profile', async () => {
  const h = harness();
  h.setReply(async () => ({ ok: true, status: 200, json: async () => ({ details: { countryCode: 'ZZ', phoneNumber: null } }) }));
  await assert.rejects(h.api.getAccountDetails(), /Choose your country/);
  h.storage.set('pipwise.pending-registration.v1', '{"email":"member@example.test","details":{"countryCode":"ZZ"},"expiresAt":1800000100000,"id":"bad"}');
  const before = h.requests.length;
  await h.api.syncPendingRegistrationDetails(member);
  assert.equal(h.requests.length, before);
  assert.equal(h.storage.size, 0);
});
