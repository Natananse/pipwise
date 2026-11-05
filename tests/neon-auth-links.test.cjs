const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, URL, URLSearchParams, setTimeout, clearTimeout,
    require: name => name in imports ? imports[name] : load(path.resolve(path.dirname(file), `${name}.ts`), imports),
  });
  return module.exports;
}

function harness({ platform = 'web', refresh = async () => ({ user: { id: 'tester' } }), nativeComplete = async () => { throw new Error('This sign-in link could not be completed.'); }, timeoutMs } = {}) {
  let refreshCalls = 0;
  const { withStartupTimeout } = load('src/lib/startupTasks.ts');
  const api = load('src/lib/authLinks.ts', {
    'expo-auth-session': { makeRedirectUri: options => options },
    'react-native': { Platform: { OS: platform } },
    './neonAuth': {
      refreshAuthSession: async () => { refreshCalls += 1; return refresh(); },
      completeNativeAuthCallback: nativeComplete,
    },
    './startupTasks': { withStartupTimeout: (task, message) => withStartupTimeout(task, message, timeoutMs) },
  });
  return { ...api, refreshCalls: () => refreshCalls };
}

const webCallback = 'https://app.example.test/auth-callback?neon_auth_session_verifier=one-use-verifier';

test('Neon web callbacks restore and publish the session through the shared refresh operation', async () => {
  const api = harness();
  assert.equal((await api.completeAuthCallback(webCallback)).recovery, false);
  assert.equal(api.refreshCalls(), 1);
});

test('unsolicited native OAuth and legacy Supabase callbacks cannot access a Neon account', async () => {
  for (const platform of ['ios', 'android', 'web']) {
    const api = harness({ platform });
    const urls = [
      'pipwise://auth-callback#access_token=old-access&refresh_token=old-refresh',
      'https://app.example.test/auth-callback?code=old-pkce-code',
      'pipwise://auth-callback',
    ];
    if (platform !== 'web') urls.push(webCallback);
    for (const url of urls) await assert.rejects(api.completeAuthCallback(url), /could not be completed/);
    assert.equal(api.refreshCalls(), 0);
  }
});

test('native browser callbacks finish through the challenge-bound native flow', async () => {
  const calls = [];
  for (const platform of ['ios', 'android']) {
    const api = harness({ platform, nativeComplete: async url => { calls.push(url); return { user: { id: 'tester' } }; } });
    const url = 'pipwise://auth-callback?state=pending-state&neon_auth_session_verifier=one-use';
    assert.equal((await api.completeAuthCallback(url)).recovery, false);
    assert.equal(calls.at(-1), url);
    assert.equal(api.refreshCalls(), 0, 'native exchange must not use the browser cookie store');
  }
});

test('email recovery tokens reach the password form without a signed-in session', async () => {
  for (const platform of ['ios', 'android', 'web']) {
    const api = harness({ platform });
    const result = await api.completeAuthCallback('pipwise://auth-callback?flow=recovery&token=recovery-token');
    assert.equal(result.recovery, true);
    assert.equal(result.token, 'recovery-token');
    assert.equal(api.refreshCalls(), 0);
  }
});

test('missing sessions, denied callbacks, and malformed links report failures', async () => {
  const missing = harness({ refresh: async () => null });
  await assert.rejects(missing.completeAuthCallback(webCallback), /did not create a session/);
  const denied = harness();
  for (const url of [
    'not a URL',
    `${webCallback}&error=access_denied&error_description=private-detail`,
    `${webCallback}#error_code=expired`,
  ]) await assert.rejects(denied.completeAuthCallback(url), error => /incomplete or expired/.test(error.message) && !error.message.includes('private-detail'));
  assert.equal(denied.refreshCalls(), 0);
  const unavailable = harness({ refresh: async () => { throw new Error('Account server unavailable'); } });
  await assert.rejects(unavailable.completeAuthCallback(webCallback), /Account server unavailable/);
});

test('a stalled Neon callback has a bounded error and can be retried', async () => {
  let stalled = true;
  const api = harness({
    timeoutMs: 5,
    refresh: () => stalled ? new Promise(() => {}) : Promise.resolve({ user: { id: 'tester' } }),
  });
  await assert.rejects(api.completeAuthCallback(webCallback), /Sign-in took too long/);
  stalled = false;
  assert.equal((await api.completeAuthCallback(webCallback)).recovery, false);
  assert.equal(api.refreshCalls(), 2);
});
