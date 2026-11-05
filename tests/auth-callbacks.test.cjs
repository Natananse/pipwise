const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, URL, URLSearchParams, setTimeout, clearTimeout,
    require: name => name in imports ? imports[name] : load(path.resolve(path.dirname(file), `${name}.ts`)),
  });
  return module.exports;
}
const { authCallbackParameters, createAuthCallbackHandler } = load('src/lib/authCallbacks.ts');
const { publicSupabaseConfig } = load('src/lib/supabaseConfig.ts');
const success = { data: { session: { user: { id: 'tester' } } }, error: null };

test('public Auth configuration supports publishable and legacy anon keys without crashing on placeholders', () => {
  const publishable = 'sb_publishable_abcdefghijklmnop12345678';
  const anon = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl';
  assert.equal(publicSupabaseConfig('https://auth.example.test', ` ${publishable} `, anon).key, publishable);
  assert.equal(publicSupabaseConfig('http://127.0.0.1:54321', '', anon).key, anon);
  for (const [url, key] of [
    [undefined, undefined],
    ['not-a-url', publishable],
    ['https://your-project.supabase.co', publishable],
    ['https://auth.example.test', 'your-publishable-or-anon-key'],
    ['https://auth.example.test', 'sb_secret_abcdefghijklmnop12345678'],
    ['https://user:password@auth.example.test', publishable],
  ]) assert.equal(publicSupabaseConfig(url, key), null);
});

test('email confirmation and OAuth token fragments restore a session exactly once', async () => {
  const calls = [];
  const callback = createAuthCallbackHandler({ setSession: async values => { calls.push(values); return success; } });
  const url = 'pipwise://auth-callback#access_token=test-access&refresh_token=test-refresh&type=signup';
  const [first, duplicate] = await Promise.all([callback(url), callback(url)]);
  assert.equal(first.recovery, false);
  assert.equal(duplicate.recovery, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].access_token, 'test-access');
  assert.equal(calls[0].refresh_token, 'test-refresh');
  await callback(url);
  assert.equal(calls.length, 1, 'route and browser completion cannot consume the same link twice');
});

test('PKCE callbacks exchange the one-use code and preserve recovery intent', async () => {
  const codes = [];
  const callback = createAuthCallbackHandler({ exchangeCodeForSession: async code => { codes.push(code); return success; } });
  const result = await callback('pipwise://auth-callback?code=one-use-code&flow=recovery');
  assert.equal(result.recovery, true);
  assert.deepEqual(codes, ['one-use-code']);
});

test('implicit recovery fragments and configured email token hashes open password recovery', async () => {
  const requests = [];
  const callback = createAuthCallbackHandler({
    setSession: async () => success,
    verifyOtp: async values => { requests.push(values); return success; },
  });
  assert.equal((await callback('pipwise://auth-callback#access_token=a&refresh_token=r&type=recovery')).recovery, true);
  assert.equal((await callback('https://app.example.test/auth-callback?token_hash=hashed-email-token&type=recovery')).recovery, true);
  assert.equal(requests[0].token_hash, 'hashed-email-token');
  assert.equal(requests[0].type, 'recovery');
});

test('malformed, denied and incomplete callbacks never attempt account access', async () => {
  let requests = 0;
  const request = async () => { requests += 1; return success; };
  const callback = createAuthCallbackHandler({ setSession: request, exchangeCodeForSession: request, verifyOtp: request });
  for (const url of [
    'not a URL',
    'pipwise://auth-callback',
    'pipwise://auth-callback#access_token=missing-refresh',
    'pipwise://auth-callback?token_hash=hash&type=sms',
    'pipwise://auth-callback?error=access_denied&error_description=private-provider-detail',
    'pipwise://auth-callback#error_code=otp_expired&access_token=a&refresh_token=r',
  ]) await assert.rejects(callback(url), /incomplete or expired/);
  assert.equal(requests, 0);
  assert.throws(() => authCallbackParameters('pipwise://auth-callback?error=denied&error_description=private-provider-detail'), error => !error.message.includes('private-provider-detail'));
});

test('failed verification can be retried, but a missing session never counts as success', async () => {
  let fail = true;
  let calls = 0;
  const callback = createAuthCallbackHandler({ exchangeCodeForSession: async () => {
    calls += 1;
    return fail ? { data: { session: null }, error: new Error('Network unavailable') } : success;
  } });
  const url = 'pipwise://auth-callback?code=retry-code';
  await assert.rejects(callback(url), /Network unavailable/);
  fail = false;
  assert.equal((await callback(url)).recovery, false);
  assert.equal(calls, 2);
  const empty = createAuthCallbackHandler({ setSession: async () => ({ data: { session: null }, error: null }) });
  await assert.rejects(empty('pipwise://auth-callback#access_token=a&refresh_token=r'), /incomplete or expired/);
});

test('stalled callback verification reports a bounded error and can be retried', async () => {
  let fail = true;
  const imports = { './startupTasks': { withStartupTimeout: async (promise, message) => {
    if (fail) throw new Error(message);
    return promise;
  } } };
  const { createAuthCallbackHandler: createControlled } = load('src/lib/authCallbacks.ts', imports);
  const callback = createControlled({ exchangeCodeForSession: async () => success });
  await assert.rejects(callback('pipwise://auth-callback?code=slow-code'), /Sign-in took too long/);
  fail = false;
  assert.equal((await callback('pipwise://auth-callback?code=slow-code')).recovery, false);
});
