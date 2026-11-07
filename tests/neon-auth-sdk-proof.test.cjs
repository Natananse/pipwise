const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const authUrl = 'https://auth.example.test/neondb/auth';
const user = { id: '12345678-1234-1234-1234-123456789012', email: 'member@example.test', emailVerified: true };
const opaqueProof = 'OPAQUE_SESSION_PLACEHOLDER';
const jwt = 'e30.eyJleHAiOjQxMDI0NDQ4MDB9.c2lnbmF0dXJl';

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, URL, Headers, crypto: webcrypto,
    setTimeout, clearTimeout, process: { env: { EXPO_PUBLIC_NEON_AUTH_URL: authUrl } },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}

async function exerciseSdk(platform, includeJwtHeader, run) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const storage = new Map();
  // The real installed SDK uses the host realm's fetch. Every possible call is
  // replaced before importing it; no request can reach an actual Auth service.
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, new URL(authUrl).origin);
    assert.ok([`${new URL(authUrl).pathname}/get-session`, `${new URL(authUrl).pathname}/token`].includes(url.pathname));
    requests.push({ path: url.pathname, headers: new Headers(options?.headers) });
    if (url.pathname.endsWith('/token')) return Response.json({ token: jwt });
    return Response.json({ user, session: { token: opaqueProof } }, { headers: {
      ...(includeJwtHeader ? { 'set-auth-jwt': jwt } : {}),
      'set-cookie': '__Secure-neon-auth.session_token=RENEWED_COOKIE_PLACEHOLDER; Max-Age=3600; Secure; HttpOnly',
    } });
  };
  try {
    const sdk = await import('@neon/auth');
    const adapters = await import('@neon/auth/vanilla/adapters');
    const cookies = load('src/lib/neonCookies.ts');
    const api = load('src/lib/neonAuth.ts', {
      'react-native-url-polyfill/auto': {},
      'react-native': { Platform: { OS: platform } },
      './neonCookies': cookies,
      './startupTasks': load('src/lib/startupTasks.ts'),
      './accountProfile': load('src/lib/accountProfile.ts'),
      './secureStorage': { loadSecureStore: async () => ({
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
        getItemAsync: async key => storage.get(key) ?? null,
        setItemAsync: async (key, value) => { storage.set(key, value); },
        deleteItemAsync: async key => { storage.delete(key); },
      }) },
      './nativeOAuth': { createNativeOAuthController: () => ({ restore: async () => {}, captureCookies: async () => {} }) },
      'expo-crypto': { randomUUID: webcrypto.randomUUID, getRandomValues: webcrypto.getRandomValues },
      '@neon/auth': sdk,
      '@neon/auth/vanilla/adapters': adapters,
    });
    await run({ api, requests, storage, storageKey: cookies.neonCookieStorageKey(authUrl) });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('installed SDK JWT substitution preserves opaque backend proof and native cookie renewal', async () => {
  for (const platform of ['web', 'android']) {
    await exerciseSdk(platform, true, async ({ api, requests, storage, storageKey }) => {
      const credentials = await api.getBackendCredentials(user.id);
      assert.deepEqual(JSON.parse(JSON.stringify(credentials)), { accountId: user.id, sessionToken: opaqueProof, token: jwt });
      assert.equal(requests.length, 1, 'Use the JWT from the same response instead of a second cached token request');
      assert.equal(requests[0].path, '/neondb/auth/get-session');
      if (platform === 'android') {
        assert.equal(JSON.parse(storage.get(storageKey)).cookie.value, 'RENEWED_COOKIE_PLACEHOLDER');
        assert.equal(requests[0].headers.get('origin'), new URL(authUrl).origin);
      }
      const profile = await api.getAuthSession();
      assert.equal(profile.user.id, user.id);
      assert.ok(!JSON.stringify(profile).includes(opaqueProof));
      assert.ok(!JSON.stringify(profile).includes(jwt));
    });
  }
});

test('missing JWT response header forces the real SDK token endpoint past its shared session cache', async () => {
  for (const platform of ['web', 'android']) {
    await exerciseSdk(platform, false, async ({ api, requests }) => {
      const credentials = await api.getBackendCredentials(user.id);
      assert.deepEqual(JSON.parse(JSON.stringify(credentials)), { accountId: user.id, sessionToken: opaqueProof, token: jwt });
      assert.deepEqual(requests.map(request => request.path), ['/neondb/auth/get-session', '/neondb/auth/token']);
    });
  }
});
