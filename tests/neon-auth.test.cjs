const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const authUrl = 'https://auth.example.test/neondb/auth';
const user = { id: 'tester', email: 'tester@example.test', name: 'Tester', emailVerified: true };

function load(file, imports = {}, env = {}, onImport = () => {}, runtime = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise, URL, Headers, crypto: webcrypto, setTimeout, clearTimeout,
    process: { env: { EXPO_PUBLIC_NEON_AUTH_URL: authUrl, ...env } }, ...runtime,
    require(name) {
      onImport(name);
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}

const cookies = load('src/lib/neonCookies.ts');
const startupTasks = load('src/lib/startupTasks.ts');
const profile = load('src/lib/accountProfile.ts');

function harness({ platform = 'web', savedCookie, socialEnabled = false, secureStorageAvailable = true } = {}) {
  const storage = new Map();
  const storageKey = cookies.neonCookieStorageKey(authUrl);
  if (savedCookie) storage.set(storageKey, savedCookie);
  let adapterOptions;
  let result = { data: { user, session: { id: 'app-session' } }, error: null };
  let signInError = null;
  let signUpResult = { data: { user }, error: null };
  let clock = Date.now();
  const reads = [];
  const socialRequests = [];
  const signUpRequests = [];
  const verificationRequests = [];
  const profileRequests = [];
  const profileFetchOptions = [];
  const storeBehavior = { beforeWrite: null };
  const moduleLoads = [];
  let storageAvailable = secureStorageAvailable;
  let currentAttempt = 'test-attempt';
  const native = {
    restore: async () => {},
    attemptId: () => currentAttempt,
    challengeHeader: () => '__Secure-neon-auth.session_challenge=native-proof',
    captureCookies: async () => {},
    clear: async () => { currentAttempt = null; },
    start: async (provider, request, exchange) => {
      await request(`https://app.example.test/native-auth.html?state=${provider}-state`);
      return exchange('native-verifier');
    },
    complete: async (url, exchange) => {
      const attempt = currentAttempt;
      const session = await exchange(new URL(url).searchParams.get('neon_auth_session_verifier'));
      if (currentAttempt !== attempt) throw new Error('This sign-in attempt has expired.');
      return session;
    },
  };
  const client = {
    getSession: async options => { reads.push(options); return result; },
    signIn: {
      email: async () => ({ error: signInError }),
      social: async options => {
        socialRequests.push(options);
        return { data: { url: `${authUrl}/sign-in/social/init?token=opaque-init` }, error: null };
      },
    },
    signOut: async () => ({ error: null }),
    signUp: { email: async options => { signUpRequests.push(options); return signUpResult; } },
    emailOtp: {
      sendVerificationOtp: async options => { verificationRequests.push(options); return { error: null }; },
      verifyEmail: async () => ({ error: null }),
    },
    updateUser: async (options, fetchOptions) => { profileRequests.push(options); profileFetchOptions.push(fetchOptions); return { data: { status: true }, error: null }; },
  };
  const secureStorage = load('src/lib/secureStorage.ts', {
    expo: { requireOptionalNativeModule: name => { assert.equal(name, 'ExpoSecureStore'); return storageAvailable ? {} : null; } },
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
      getItemAsync: async key => storage.get(key) ?? null,
      setItemAsync: async (key, value, options) => {
        assert.equal(options.keychainAccessible, 'device-only');
        await storeBehavior.beforeWrite?.(key, value);
        storage.set(key, value);
      },
      deleteItemAsync: async key => { storage.delete(key); },
    },
  }, {}, name => moduleLoads.push(name));
  const api = load('src/lib/neonAuth.ts', {
    'react-native-url-polyfill/auto': {},
    'react-native': { Platform: { OS: platform } },
    './neonCookies': cookies,
    './startupTasks': startupTasks,
    './secureStorage': secureStorage,
    './accountProfile': profile,
    './nativeOAuth': { createNativeOAuthController: () => native },
    '@neon/auth': { createAuthClient: url => { assert.equal(url, authUrl); return client; } },
    '@neon/auth/vanilla/adapters': { BetterAuthVanillaAdapter: options => { adapterOptions = options; return {}; } },
    'expo-crypto': { randomUUID: webcrypto.randomUUID, getRandomValues: webcrypto.getRandomValues },
  }, { EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: socialEnabled ? '1' : '0', EXPO_PUBLIC_APPLE_AUTH_ENABLED: socialEnabled ? '1' : '0' }, name => moduleLoads.push(name), {
    Date: class extends Date { static now() { return clock; } },
  });
  return {
    api, storage, storageKey, reads, socialRequests, signUpRequests, verificationRequests, profileRequests, profileFetchOptions, native, client, storeBehavior, moduleLoads,
    advanceTime: milliseconds => { clock += milliseconds; },
    signupResult: next => { signUpResult = next; },
    setSecureStorageAvailable: value => { storageAvailable = value; },
    hooks: () => adapterOptions.fetchOptions,
    session: next => { result = { data: next ? { user: next } : null, error: null }; },
    failSession: error => { result = { data: null, error }; },
    failSignIn: error => { signInError = error; },
  };
}

test('missing native secure storage blocks module evaluation and SDK initialization, then remains retryable', async () => {
  const h = harness({ platform: 'android', secureStorageAvailable: false });
  await assert.rejects(h.api.getAuthSession(), error => error.code === 'NATIVE_SECURE_STORAGE_UNAVAILABLE'
    && /Rebuild and install/.test(error.message));
  assert.equal(h.moduleLoads.includes('expo-secure-store'), false);
  assert.equal(h.moduleLoads.includes('@neon/auth'), false);
  assert.equal(h.moduleLoads.includes('./nativeOAuth'), false);
  assert.equal(h.reads.length, 0);
  assert.equal(h.storage.size, 0);
  h.setSecureStorageAvailable(true);
  assert.equal((await h.api.getAuthSession()).user.id, user.id);
  assert.equal(h.moduleLoads.includes('expo-secure-store'), true);
  assert.equal(h.moduleLoads.includes('@neon/auth'), true);
  assert.equal(h.reads.length, 1);
});

test('unverified email errors retain the server code needed to resume confirmation', async () => {
  const h = harness();
  h.failSignIn({ code: 'EMAIL_NOT_VERIFIED', message: 'Email is not verified' });
  await assert.rejects(h.api.signIn(user.email, 'test-password'), error =>
    error instanceof h.api.AccountAccessError && error.code === 'EMAIL_NOT_VERIFIED'
      && error.message === 'Email is not verified');
  assert.equal(h.reads.length, 0, 'failed sign-in must not restore or publish a session');
});

test('sign-up sends the chosen name and restores the canonical name for native and web profiles', async () => {
  for (const platform of ['web', 'android']) {
    const h = harness({ platform });
    const name = 'ናትናኤል ተስፋዬ';
    h.session({ ...user, name });
    const changes = [];
    h.api.subscribeAuth(session => changes.push(session));
    const session = await h.api.signUp(user.email, 'test-password', '  ናትናኤል\u00a0  ተስፋዬ  ');
    assert.equal(h.signUpRequests.length, 1);
    assert.equal(h.signUpRequests[0].email, user.email);
    assert.equal(h.signUpRequests[0].password, 'test-password');
    assert.equal(h.signUpRequests[0].name, name);
    assert.notEqual(h.signUpRequests[0].name, user.email.split('@')[0]);
    assert.equal(session.user.name, name);
    assert.equal(changes[0].user.name, name);
    assert.equal(h.reads[0].fetchOptions.headers['X-Force-Fetch'], 'true');
  }
});

test('unconfirmed sign-up retains the chosen name without publishing an authenticated session', async () => {
  const h = harness();
  h.signupResult({ data: { user: { ...user, emailVerified: false } }, error: null });
  h.session(null);
  const changes = [];
  h.api.subscribeAuth(session => changes.push(session));
  assert.equal(await h.api.signUp(user.email, 'test-password', 'Cher'), null);
  assert.equal(h.signUpRequests[0].name, 'Cher');
  assert.equal(h.verificationRequests.length, 1);
  assert.equal(h.verificationRequests[0].email, user.email);
  assert.equal(h.verificationRequests[0].type, 'email-verification');
  assert.equal(h.reads.length, 0, 'unverified signup must not restore an authenticated session');
  assert.deepEqual(changes, []);
});

test('unverified server sessions never enter the app, even when verification was previously optional', async () => {
  for (const platform of ['web', 'android']) {
    const h = harness({ platform });
    h.session({ ...user, emailVerified: false });
    assert.equal(await h.api.getAuthSession(), null);
    assert.equal(h.storage.size, 0);
  }
});

test('created accounts remain on the confirmation flow when OTP delivery fails and can retry immediately', async () => {
  for (const throws of [false, true]) {
    const h = harness();
    h.signupResult({ data: { user: { ...user, emailVerified: false } }, error: null });
    const send = h.client.emailOtp.sendVerificationOtp;
    h.client.emailOtp.sendVerificationOtp = async () => {
      if (throws) throw new Error('private SMTP details');
      return { error: { message: 'private SMTP details', code: 'FAILED_TO_SEND_EMAIL' } };
    };
    await assert.rejects(h.api.signUp(user.email, 'test-password', 'Tester'), error =>
      error instanceof h.api.AccountVerificationError && error.accountCreated === true
        && error.code === 'VERIFICATION_DELIVERY_FAILED' && !error.message.includes('private SMTP'));
    h.client.emailOtp.sendVerificationOtp = send;
    await h.api.resendVerification(user.email);
    assert.equal(h.signUpRequests.length, 1, 'delivery retry must not create a second account');
    assert.equal(h.verificationRequests.length, 1);
  }
});

test('rejected signup never sends a verification email', async () => {
  const h = harness();
  h.signupResult({ data: null, error: { message: 'Account rejected', code: 'SIGNUP_REJECTED' } });
  await assert.rejects(h.api.signUp(user.email, 'test-password', 'Tester'), error => error.code === 'SIGNUP_REJECTED');
  assert.equal(h.verificationRequests.length, 0);
});

test('concurrent requests share one OTP, and successful delivery imposes a one-minute resend cooldown', async () => {
  const h = harness();
  let release;
  const delivery = new Promise(resolve => { release = resolve; });
  h.client.emailOtp.sendVerificationOtp = async options => {
    h.verificationRequests.push(options);
    await delivery;
    return { error: null };
  };
  const first = h.api.resendVerification(user.email);
  const duplicate = h.api.resendVerification(`  ${user.email.toUpperCase()}  `);
  release();
  await Promise.all([first, duplicate]);
  assert.equal(h.verificationRequests.length, 1);
  await assert.rejects(h.api.resendVerification(user.email), error => error.code === 'VERIFICATION_RATE_LIMITED');
  h.advanceTime(59999);
  await assert.rejects(h.api.resendVerification(user.email), /wait 1 second/);
  assert.equal(h.verificationRequests.length, 1);
  h.advanceTime(1);
  await h.api.resendVerification(user.email);
  assert.equal(h.verificationRequests.length, 2);
});

test('failed verification preserves cooldown, but successful confirmation clears it', async () => {
  const h = harness();
  await h.api.resendVerification(user.email);
  h.client.emailOtp.verifyEmail = async () => ({ error: { code: 'INVALID_OTP', message: 'Invalid code' } });
  await assert.rejects(h.api.verifyEmail(user.email, 'wrong'), /Invalid code/);
  await assert.rejects(h.api.resendVerification(user.email), error => error.code === 'VERIFICATION_RATE_LIMITED');
  h.client.emailOtp.verifyEmail = async () => ({ error: null });
  await h.api.verifyEmail(user.email, '123456');
  await h.api.resendVerification(user.email);
  assert.equal(h.verificationRequests.length, 2);
});

test('invalid profile names are rejected before initializing the account client', async () => {
  for (const name of ['', ' ', 'Name\u0000Hidden', 'x'.repeat(81)]) {
    const h = harness();
    await assert.rejects(h.api.signUp(user.email, 'test-password', name));
    await assert.rejects(h.api.updateDisplayName(name));
    assert.equal(h.moduleLoads.includes('@neon/auth'), false);
    assert.equal(h.signUpRequests.length, 0);
    assert.equal(h.profileRequests.length, 0);
    assert.equal(h.reads.length, 0);
  }
});

test('updating a name sends only the supported name field and publishes the force-fetched canonical profile', async () => {
  const h = harness();
  h.client.updateUser = async options => {
    h.profileRequests.push(options);
    h.session({ ...user, name: 'Canonical profile name' });
    return { data: { status: true }, error: null };
  };
  const changes = [];
  h.api.subscribeAuth(session => changes.push(session));
  const session = await h.api.updateDisplayName('  Requested\u00a0 Name ');
  assert.deepEqual(Object.keys(h.profileRequests[0]), ['name']);
  assert.equal(h.profileRequests[0].name, 'Requested Name');
  assert.equal(h.reads.length, 1);
  assert.equal(h.reads[0].fetchOptions.headers['X-Force-Fetch'], 'true');
  assert.equal(session.user.name, 'Canonical profile name', 'backend session remains authoritative');
  assert.equal(changes[0], session);
});

test('failed name updates show a safe message and do not replace the current session', async () => {
  for (const throws of [false, true]) {
    const h = harness();
    h.client.updateUser = async () => {
      if (throws) throw new Error('private provider details');
      return { data: null, error: { message: 'private provider details' } };
    };
    const changes = [];
    h.api.subscribeAuth(session => changes.push(session));
    await assert.rejects(h.api.updateDisplayName('New Name'), /Your name could not be saved/);
    assert.equal(h.reads.length, 0);
    assert.deepEqual(changes, []);
  }
});

test('profile mutation and canonical refresh receive SDK network deadlines', async () => {
  const h = harness();
  await h.api.updateDisplayName('New Name');
  assert.equal(h.profileFetchOptions[0].timeout, 10000);
  assert.equal(h.reads[0].fetchOptions.timeout, 10000);
  assert.equal(h.reads[0].fetchOptions.headers['X-Force-Fetch'], 'true');
});

test('a failed canonical refresh is not reported as a successful profile save', async () => {
  const h = harness();
  h.failSession({ message: 'private provider details' });
  const changes = [];
  h.api.subscribeAuth(session => changes.push(session));
  await assert.rejects(h.api.updateDisplayName('New Name'), /name was saved, but your profile could not refresh/);
  assert.equal(h.profileRequests.length, 1);
  assert.deepEqual(changes, []);
  h.session(null);
  await assert.rejects(h.api.updateDisplayName('New Name'), /Sign in again/);
  assert.deepEqual(changes, [null], 'an actually missing canonical session cannot be preserved as authenticated');
});

test('native social sign-in uses managed browser initiation and a force-fetched verifier exchange', async () => {
  for (const platform of ['android', 'ios']) {
    const h = harness({ platform, socialEnabled: true });
    const changes = [];
    h.api.subscribeAuth(session => changes.push(session));
    await h.api.signInWithGoogle('pipwise://auth-callback');
    assert.equal(h.socialRequests[0].provider, 'google');
    assert.equal(h.socialRequests[0].disableRedirect, true);
    assert.match(h.socialRequests[0].callbackURL, /^https:\/\/app\.example\.test\/native-auth\.html/);
    assert.equal(h.reads[0].fetchOptions.query.neon_auth_session_verifier, 'native-verifier');
    assert.equal(h.reads[0].fetchOptions.headers['X-Force-Fetch'], 'true');
    assert.equal(changes[0].user.id, user.id);
    const request = { url: `${authUrl}/get-session?neon_auth_session_verifier=native-verifier`, headers: new Headers() };
    h.hooks().onRequest(request);
    assert.equal(request.headers.get('Cookie'), '__Secure-neon-auth.session_challenge=native-proof');
  }
});

test('native verifier exchanges never fall back to a durable session cookie', async () => {
  const h = harness({ platform: 'ios', socialEnabled: true });
  await h.api.getAuthSession();
  h.native.challengeHeader = () => '';
  const request = { url: `${authUrl}/get-session?neon_auth_session_verifier=unsolicited`, headers: new Headers() };
  assert.throws(() => h.hooks().onRequest(request), /expired/);
  assert.equal(request.headers.get('Cookie'), null);
});

test('web Google and Apple use managed browser redirects without a native verifier exchange', async () => {
  const h = harness({ socialEnabled: true });
  await h.api.signInWithGoogle('https://app.example.test/auth-callback');
  await h.api.signInWithApple('https://app.example.test/auth-callback');
  assert.equal(h.socialRequests[0].provider, 'google');
  assert.equal(h.socialRequests[1].provider, 'apple');
  assert.equal(h.socialRequests[0].disableRedirect, undefined);
  assert.equal(h.reads.length, 0);
});

test('social login remains gated until the provider is explicitly enabled', async () => {
  const h = harness({ platform: 'android' });
  await assert.rejects(h.api.signInWithGoogle('pipwise://auth-callback'), /currently unavailable/);
  assert.equal(h.socialRequests.length, 0);
});

test('a late anonymous startup read cannot erase the newly exchanged native session cookie', async () => {
  const h = harness({ platform: 'android' });
  await h.api.getAuthSession();
  let finishRead;
  h.client.getSession = () => new Promise(resolve => { finishRead = resolve; });
  const pending = h.api.getAuthSession();
  await new Promise(resolve => setImmediate(resolve));
  await h.hooks().onSuccess({ response: { headers: new Headers({
    'set-cookie': '__Secure-neon-auth.session_token=new-session; Max-Age=3600; Secure; HttpOnly',
  }) } });
  finishRead({ data: null, error: null });
  assert.equal(await pending, null);
  assert.equal(JSON.parse(h.storage.get(h.storageKey)).cookie.value, 'new-session');
});

test('a cancelled verifier response cannot install a durable session cookie', async () => {
  const h = harness({ platform: 'android' });
  await h.api.getAuthSession();
  h.native.challengeHeader = () => '';
  await h.hooks().onSuccess({
    request: { url: `${authUrl}/get-session?neon_auth_session_verifier=cancelled` },
    response: { headers: new Headers({ 'set-cookie': '__Secure-neon-auth.session_token=late-session; Max-Age=3600' }) },
  });
  assert.equal(h.storage.has(h.storageKey), false);
});

test('cancelling while a verifier cookie is being saved rolls it back without publishing sign-in', async () => {
  const h = harness({ platform: 'android' });
  await h.api.getAuthSession();
  const changes = [];
  h.api.subscribeAuth(session => changes.push(session));
  let resumeSave;
  let markSaving;
  const saving = new Promise(resolve => { markSaving = resolve; });
  h.storeBehavior.beforeWrite = async () => {
    h.storeBehavior.beforeWrite = null;
    markSaving();
    await new Promise(resolve => { resumeSave = resolve; });
  };
  h.client.getSession = async () => {
    await h.hooks().onSuccess({
      request: { url: `${authUrl}/get-session?neon_auth_session_verifier=cancel-during-save` },
      response: { headers: new Headers({ 'set-cookie': '__Secure-neon-auth.session_token=cancelled-session; Max-Age=3600' }) },
    });
    return { data: { user, session: { id: 'created-session' } }, error: null };
  };
  const completing = h.api.completeNativeAuthCallback('pipwise://auth-callback?neon_auth_session_verifier=cancel-during-save');
  const rejected = assert.rejects(completing, /expired/);
  await saving;
  const cancelling = h.api.cancelNativeAuth();
  resumeSave();
  await cancelling;
  await rejected;
  assert.equal(h.storage.has(h.storageKey), false);
  assert.equal(changes.length, 0);
});

test('cancelling after cookie storage but before callback completion restores the previous credential', async () => {
  const previous = { name: '__Secure-neon-auth.session_token', value: 'previous-session', expiresAt: Date.now() + 60000 };
  const h = harness({ platform: 'android', savedCookie: JSON.stringify({ url: authUrl, cookie: previous }) });
  await h.api.getAuthSession();
  let responseReady;
  let finishResponse;
  const ready = new Promise(resolve => { responseReady = resolve; });
  h.client.getSession = async () => {
    await h.hooks().onSuccess({
      request: { url: `${authUrl}/get-session?neon_auth_session_verifier=cancel-before-completion` },
      response: { headers: new Headers({ 'set-cookie': '__Secure-neon-auth.session_token=tentative-session; Max-Age=3600' }) },
    });
    responseReady();
    await new Promise(resolve => { finishResponse = resolve; });
    return { data: { user, session: { id: 'created-session' } }, error: null };
  };
  const completing = h.api.completeNativeAuthCallback('pipwise://auth-callback?neon_auth_session_verifier=cancel-before-completion');
  const rejected = assert.rejects(completing, /expired/);
  await ready;
  assert.equal(JSON.parse(h.storage.get(h.storageKey)).cookie.value, 'tentative-session');
  await h.api.cancelNativeAuth();
  finishResponse();
  await rejected;
  assert.equal(JSON.parse(h.storage.get(h.storageKey)).cookie.value, previous.value);
});

test('external session refresh publishes success and sign-out, while failures preserve state', async () => {
  const h = harness();
  const changes = [];
  const unsubscribe = h.api.subscribeAuth(session => changes.push(session));
  await h.api.getAuthSession();
  assert.equal(changes.length, 0, 'a read alone has no lifecycle side effects');
  await h.api.refreshAuthSession();
  assert.equal(changes[0].user.id, user.id);
  assert.equal(h.reads[0].fetchOptions.headers['X-Force-Fetch'], 'true');
  h.failSession({ code: 'SERVER_ERROR', message: 'Server unavailable' });
  await assert.rejects(h.api.refreshAuthSession(), /Server unavailable/);
  assert.equal(changes.length, 1);
  h.session(null);
  await h.api.refreshAuthSession();
  assert.equal(changes[1], null);
  unsubscribe();
  await h.api.refreshAuthSession();
  assert.equal(changes.length, 2);
});

test('native authenticated requests include the accepted Neon origin and scope credentials to its service', async () => {
  const cookie = { name: '__Secure-neon-auth.session_token', value: 'signed-session', expiresAt: Date.now() + 60000 };
  const h = harness({ platform: 'android', savedCookie: JSON.stringify({ url: authUrl, cookie }) });
  await h.api.getAuthSession();
  const request = { url: `${authUrl}/sign-out`, headers: new Headers() };
  h.hooks().onRequest(request);
  assert.equal(request.headers.get('Origin'), new URL(authUrl).origin);
  assert.equal(request.headers.get('Cookie'), '__Secure-neon-auth.session_token=signed-session');
  for (const url of ['https://other.example.test/neondb/auth/sign-out', 'https://auth.example.test/neondb/rest/v1/profile', `${authUrl}-other/sign-out`]) {
    const rejected = { url, headers: new Headers() };
    assert.throws(() => h.hooks().onRequest(rejected), /unexpected address/);
    assert.equal(rejected.headers.get('Cookie'), null);
  }
});

test('native session renewal persists the token securely and sign-out removes it', async () => {
  const h = harness({ platform: 'ios' });
  await h.api.getAuthSession();
  await h.hooks().onSuccess({ response: { headers: new Headers({
    'set-cookie': '__Secure-neon-auth.session_token=renewed-session; Max-Age=3600; Secure; HttpOnly',
  }) } });
  assert.equal(JSON.parse(h.storage.get(h.storageKey)).cookie.value, 'renewed-session');
  const changes = [];
  h.api.subscribeAuth(session => changes.push(session));
  await h.api.signOut();
  assert.equal(h.storage.has(h.storageKey), false);
  const request = { url: `${authUrl}/get-session`, headers: new Headers() };
  h.hooks().onRequest(request);
  assert.equal(request.headers.get('Cookie'), null);
  assert.equal(changes[0], null);
});

test('a corrupt native saved credential falls back to a fresh session read', async () => {
  const h = harness({ platform: 'android', savedCookie: '{broken' });
  h.session(null);
  assert.equal(await h.api.getAuthSession(), null);
  const request = { url: `${authUrl}/get-session`, headers: new Headers() };
  h.hooks().onRequest(request);
  assert.equal(request.headers.get('Cookie'), null);
});
