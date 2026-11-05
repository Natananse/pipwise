const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const authUrl = 'https://auth.example.test/neondb/auth';
const relayUrl = 'https://pipwise.example.test/native-auth.html';
const state = 'aaf57ff3-dc02-4000-9000-39c51e3ff6f1';
const nextState = 'aaf57ff3-dc02-4000-9000-39c51e3ff6f2';
const session = { user: { id: 'tester' } };
const challenge = '__Secure-neon-auth.session_challenge=temporary; Max-Age=600';
const initURL = `${authUrl}/sign-in/social/init?token=opaque`;
const callbackURL = (s = state, verifier = 'opaque+/=') => `pipwise://auth-callback?state=${s}&neon_auth_session_verifier=${encodeURIComponent(verifier)}`;
async function waitUntil(ready) {
  for (let i = 0; i < 100; i++) {
    if (ready()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('Expected mocked operation did not become ready');
}

function load(file, context = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, URL, Promise, Date, Math, Map, JSON, Number, ...context }, { filename: file });
  return module.exports;
}
const cookies = load('src/lib/neonCookies.ts');

function harness({ storage = new Map(), returnURL = relayUrl, secureStorageAvailable = true } = {}) {
  let now = Date.parse('2026-11-04T12:00:00Z');
  let uuidCount = 0;
  let browser = async () => ({ type: 'success', url: callbackURL() });
  let networkWait = request => request;
  const opens = [];
  const timeouts = [];
  let storageAvailable = secureStorageAvailable;
  let secureStoreImports = 0;
  const secureStorage = load('src/lib/secureStorage.ts', {
    require(name) {
      if (name === 'expo') return { requireOptionalNativeModule: moduleName => {
        assert.equal(moduleName, 'ExpoSecureStore');
        return storageAvailable ? {} : null;
      } };
      if (name === 'expo-secure-store') {
        secureStoreImports++;
        return {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
          getItemAsync: async key => storage.get(key) ?? null,
          setItemAsync: async (key, value, options) => { assert.equal(options.keychainAccessible, 'device-only'); storage.set(key, value); },
          deleteItemAsync: async key => { storage.delete(key); },
        };
      }
      throw new Error(`Unexpected secure-storage import ${name}`);
    },
  });
  const api = load('src/lib/nativeOAuth.ts', {
    Date: class extends Date { static now() { return now; } },
    process: { env: { EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: returnURL } },
    require(name) {
      if (name === './neonCookies') return cookies;
      if (name === './secureStorage') return secureStorage;
      if (name === 'expo-crypto') return { randomUUID: () => uuidCount++ ? nextState : state };
      if (name === 'expo-web-browser') return { openAuthSessionAsync: async (...args) => { opens.push(args); return browser(...args); } };
      if (name === './startupTasks') return { withStartupTimeout: async (request, message) => { timeouts.push(message); return networkWait(request, message); } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const controller = api.createNativeOAuthController(authUrl);
  return { controller, storage, opens, timeouts, setBrowser: next => { browser = next; }, setNetworkWait: next => { networkWait = next; }, advance: ms => { now += ms; },
    setSecureStorageAvailable: value => { storageAvailable = value; }, secureStoreImports: () => secureStoreImports,
    begin: async (url) => {
      assert.equal(new URL(url).origin + new URL(url).pathname, relayUrl);
      assert.equal(new URL(url).searchParams.get('state'), uuidCount > 1 ? nextState : state);
      await controller.captureCookies([challenge]);
      return initURL;
    },
  };
}

test('native OAuth can load without SecureStore and restoration reports an actionable error without importing it', async () => {
  const h = harness({ secureStorageAvailable: false });
  assert.equal(h.secureStoreImports(), 0, 'loading the controller cannot evaluate SecureStore');
  await assert.rejects(h.controller.restore(), error => error.code === 'NATIVE_SECURE_STORAGE_UNAVAILABLE');
  assert.equal(h.secureStoreImports(), 0, 'an unavailable module must never be evaluated');
  assert.equal(h.storage.size, 0);
  assert.equal(h.opens.length, 0);
  h.setSecureStorageAvailable(true);
  await h.controller.restore();
  assert.equal(h.secureStoreImports(), 1, 'a failed restore remains retryable');
  assert.equal(await h.controller.start('google', h.begin, async () => session), session);
  assert.equal(h.storage.size, 0);
});

test('native browser OAuth binds the HTTPS relay, captures challenge and exchanges once', async () => {
  const h = harness();
  let exchanges = 0;
  const exchange = async verifier => {
    exchanges++;
    assert.equal(verifier, 'opaque+/=');
    assert.equal(h.controller.attemptId(), state);
    assert.equal(h.controller.challengeHeader(), '__Secure-neon-auth.session_challenge=temporary');
    return session;
  };
  assert.equal(await h.controller.start('google', h.begin, exchange), session);
  assert.deepEqual(h.opens, [[initURL, 'pipwise://auth-callback']]);
  assert.equal(h.controller.challengeHeader(), '');
  assert.equal(h.controller.attemptId(), null);
  assert.equal(h.storage.size, 0);
  assert.equal(h.timeouts.length, 2, 'network requests are bounded; interactive browser wait is not');
  assert.equal(await h.controller.complete(callbackURL(), exchange), session);
  assert.equal(exchanges, 1, 'a just-completed route callback must reuse the result');
});

test('cancel and dismiss discard a pending challenge without exchanging', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const h = harness();
    h.setBrowser(async () => ({ type }));
    assert.equal(await h.controller.start('apple', h.begin, async () => assert.fail('unexpected exchange')), null);
    assert.equal(h.storage.size, 0);
    assert.equal(h.controller.challengeHeader(), '');
    assert.equal(h.controller.attemptId(), null);
    await assert.rejects(h.controller.complete(callbackURL(), async () => session), /expired/);
  }
});

test('restart restores a pending challenge and resumes the callback', async () => {
  const first = harness();
  first.setBrowser(() => new Promise(() => {}));
  void first.controller.start('google', first.begin, async () => session);
  await waitUntil(() => first.opens.length);
  const second = harness({ storage: first.storage });
  await second.controller.restore();
  assert.equal(second.controller.attemptId(), state);
  assert.equal(second.controller.challengeHeader(), '__Secure-neon-auth.session_challenge=temporary');
  assert.equal(await second.controller.complete(callbackURL(), async () => session), session);
  assert.equal(second.storage.size, 0);
});

test('unsolicited, expired, malformed, wrong-state and wrong-address callbacks never exchange', async () => {
  const h = harness();
  const exchange = async () => assert.fail('unexpected exchange');
  await assert.rejects(h.controller.complete(callbackURL(), exchange), /expired/);
  h.setBrowser(() => new Promise(() => {}));
  void h.controller.start('google', h.begin, exchange);
  await waitUntil(() => h.opens.length);
  for (const url of [
    callbackURL(nextState), callbackURL().replace('pipwise:', 'https:'), callbackURL().replace('auth-callback?', 'other?'),
    `${callbackURL()}#fragment`, `${callbackURL()}&state=${state}`, `${callbackURL()}&neon_auth_session_verifier=duplicate`,
    callbackURL(state, ''), callbackURL(state, 'bad\r\nvalue'), callbackURL(state, 'a'.repeat(2049)),
  ]) await assert.rejects(h.controller.complete(url, exchange));
  assert.notEqual(h.controller.challengeHeader(), '', 'invalid external URLs cannot clear the legitimate attempt');
  h.advance(600000);
  assert.equal(h.controller.challengeHeader(), '');
  await assert.rejects(h.controller.complete(callbackURL(), exchange), /expired/);
});

test('cold restoration rejects corrupt records, other branches and invalid challenge credentials', async () => {
  const key = `${cookies.neonCookieStorageKey(authUrl)}.oauth`;
  const saved = { authUrl, state, createdAt: Date.parse('2026-11-04T12:00:00Z'), challenge: { name: '__Secure-neon-auth.session_challenge', value: 'temporary', expiresAt: Date.parse('2026-11-04T12:10:00Z') } };
  for (const raw of ['{broken', JSON.stringify({ ...saved, authUrl: `${authUrl}-other` }), JSON.stringify({ ...saved, state: 'guessable' }),
    JSON.stringify({ ...saved, challenge: { ...saved.challenge, name: 'Authorization' } }),
    JSON.stringify({ ...saved, challenge: { ...saved.challenge, expiresAt: null } }),
    JSON.stringify({ ...saved, challenge: { ...saved.challenge, value: 'bad; injected=cookie' } }),
  ]) {
    const h = harness({ storage: new Map([[key, raw]]) });
    await h.controller.restore();
    assert.equal(h.controller.challengeHeader(), '');
    assert.equal(h.storage.size, 0);
    await assert.rejects(h.controller.complete(callbackURL(), async () => session), /expired/);
  }
});

test('initial requests require a challenge and the exact auth init address', async () => {
  for (const initial of [
    async () => initURL,
    async (h) => { await h.controller.captureCookies([challenge]); return 'https://unexpected.example.test/sign-in/social/init'; },
    async (h) => { await h.controller.captureCookies([challenge]); return `${authUrl}/other`; },
  ]) {
    const h = harness();
    await assert.rejects(h.controller.start('google', () => initial(h), async () => session));
    assert.equal(h.opens.length, 0);
    assert.equal(h.storage.size, 0);
  }
  const h = harness();
  await h.controller.captureCookies([challenge]);
  assert.equal(h.storage.size, 0, 'unrelated server responses cannot create a pending attempt');
});

test('failed exchange stays retryable and concurrent route/browser callbacks share one exchange', async () => {
  const h = harness();
  let exchanges = 0;
  await assert.rejects(h.controller.start('google', h.begin, async () => { exchanges++; throw new Error('Network unavailable'); }), /Network unavailable/);
  assert.notEqual(h.controller.challengeHeader(), '');
  let resolveExchange;
  const exchange = () => { exchanges++; return new Promise(resolve => { resolveExchange = resolve; }); };
  const first = h.controller.complete(callbackURL(), exchange);
  const duplicate = h.controller.complete(callbackURL(), exchange);
  await waitUntil(() => resolveExchange);
  assert.equal(exchanges, 2);
  resolveExchange(session);
  assert.equal(await first, session);
  assert.equal(await duplicate, session);
  await assert.rejects(h.controller.complete(`${callbackURL()}&error=denied`, exchange), /provider/);
});

test('explicit clear invalidates an active callback and never deletes a later attempt', async () => {
  const h = harness();
  let resolveBrowser;
  h.setBrowser(() => new Promise(resolve => { resolveBrowser = resolve; }));
  const active = h.controller.start('google', h.begin, async () => assert.fail('unexpected exchange'));
  await waitUntil(() => resolveBrowser);
  await h.controller.clear();
  resolveBrowser({ type: 'success', url: callbackURL() });
  await assert.rejects(active, /expired/);
  assert.equal(h.storage.size, 0);
  h.setBrowser(async () => ({ type: 'success', url: callbackURL(nextState) }));
  assert.equal(await h.controller.start('apple', h.begin, async () => session), session);
});

test('a timed-out exchange remains deduplicated and its late success is reusable', async () => {
  const h = harness();
  let resolveExchange;
  let exchanges = 0;
  const exchange = () => { exchanges++; return new Promise(resolve => { resolveExchange = resolve; }); };
  h.setNetworkWait((request, message) => message.startsWith('Completing') ? Promise.reject(new Error('Mock network timeout')) : request);
  await assert.rejects(h.controller.start('google', h.begin, exchange), /Mock network timeout/);
  await assert.rejects(h.controller.complete(callbackURL(), exchange), /Mock network timeout/);
  assert.equal(exchanges, 1);
  resolveExchange(session);
  await waitUntil(() => h.storage.size === 0);
  assert.equal(await h.controller.complete(callbackURL(), exchange), session);
  assert.equal(exchanges, 1);
});

test('relay configuration rejects non-HTTPS, non-fixed paths, query and embedded credentials', async () => {
  for (const url of ['', 'http://localhost/native-auth.html', 'https://example.test/other', `${relayUrl}?target=elsewhere`, `${relayUrl}#fragment`, 'https://user:password@example.test/native-auth.html']) {
    const h = harness({ returnURL: url });
    await assert.rejects(h.controller.start('google', h.begin, async () => session), /not configured/);
    assert.equal(h.storage.size, 0);
  }
});
