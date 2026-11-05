const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function secureStorageErrors() {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/secureStorage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports,
    require(name) {
      assert.equal(name, 'expo');
      return { requireOptionalNativeModule: () => null };
    },
  });
  return module.exports;
}
const { SecureStorageUnavailableError } = secureStorageErrors();

function harness({ authRead = async () => null, saved = { demo: '1', disclaimer: '1', onboarded: '1' }, purchases = {}, env = {} } = {}) {
  const slots = [];
  const storageWrites = [];
  const listeners = new Set();
  let cursor = 0;
  let pendingEffects = [];
  let tree;
  let read = authRead;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const react = {
    createContext: () => ({ Provider: 'SessionProvider' }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext: context => context,
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ||= { current: initial };
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!same(slots[index]?.dependencies, dependencies)) slots[index] = { callback, dependencies };
      return slots[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!same(previous?.dependencies, dependencies)) {
        const slot = slots[index] = { dependencies, cleanup: previous?.cleanup };
        pendingEffects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  react.default = react;
  class StartupTimeoutError extends Error {}
  const imports = {
    react,
    '@react-native-async-storage/async-storage': {
      multiGet: async keys => keys.map(key => [key, saved[key] ?? null]),
      setItem: async (...args) => { storageWrites.push(['set', ...args]); },
      removeItem: async (...args) => { storageWrites.push(['remove', ...args]); },
    },
    'react-native': { Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    'react-native-purchases': purchases,
    './neonAuth': {
      authConfigured: true, getAuthSession: () => read(), signOut: async () => {},
      subscribeAuth: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
    './startupTasks': { StartupTimeoutError, withStartupTimeout: task => task },
    './secureStorage': { SecureStorageUnavailableError },
    './accountDetails': { syncPendingRegistrationDetails: async () => {} },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/session.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise, Object, __DEV__: false, process: { env },
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  const render = () => {
    cursor = 0;
    pendingEffects = [];
    tree = module.exports.SessionProvider({ children: null });
    pendingEffects.forEach(effect => effect());
  };
  render();
  return {
    storageWrites,
    value: () => tree.props.value,
    setAuthRead: next => { read = next; },
    emitSession: session => { listeners.forEach(listener => listener(session)); },
    retry: () => { tree.props.value.retryInitialization(); render(); },
    async flush() { await new Promise(resolve => setImmediate(resolve)); render(); },
    unmount: () => { slots.forEach(slot => slot.cleanup?.()); },
  };
}

test('missing native secure storage reaches the startup UI with reinstall guidance while saved setup remains intact', async () => {
  const missing = new SecureStorageUnavailableError();
  const h = harness({ authRead: async () => { throw missing; } });
  await h.flush();
  const value = h.value();
  assert.equal(value.ready, true);
  assert.equal(value.initializationError, missing.message);
  assert.match(value.initializationError, /Rebuild and install/);
  assert.equal(value.demo, true);
  assert.equal(value.onboarded, true);
  assert.equal(value.disclaimerAccepted, true);
  assert.equal(value.session, null);
  assert.deepEqual(h.storageWrites, [], 'failed native reads must not clear or migrate saved data');
  h.unmount();
});

test('unknown authentication errors stay sanitized in the startup UI', async () => {
  const h = harness({ authRead: async () => { throw new Error('Private diagnostic token=secret'); } });
  await h.flush();
  assert.equal(h.value().initializationError, 'Could not restore your sign-in session.');
  assert.ok(!h.value().initializationError.includes('secret'));
  assert.deepEqual(h.storageWrites, []);
  h.unmount();
});

test('retry restores the real session after native storage becomes available without resetting setup', async () => {
  const h = harness({ authRead: async () => { throw new SecureStorageUnavailableError(); } });
  await h.flush();
  const session = { user: { id: 'existing-user', email: 'tester@example.test' } };
  h.setAuthRead(async () => session);
  h.retry();
  await h.flush();
  assert.equal(h.value().initializationError, '');
  assert.equal(h.value().session, session);
  assert.equal(h.value().onboarded, true);
  assert.deepEqual(h.storageWrites, []);
  h.unmount();
});

test('an older failed startup cannot replace a newer authenticated session event', async () => {
  let rejectRead;
  const pending = new Promise((_resolve, reject) => { rejectRead = reject; });
  const h = harness({ authRead: () => pending });
  const session = { user: { id: 'new-session' } };
  h.emitSession(session);
  rejectRead(new SecureStorageUnavailableError());
  await h.flush();
  assert.equal(h.value().session, session);
  assert.equal(h.value().initializationError, '');
  assert.deepEqual(h.storageWrites, []);
  h.unmount();
});

test('a restored account synchronizes its billing identity and restores paid access without another login', async () => {
  const session = { user: { id: 'returning-subscriber' } };
  const logins = [];
  const h = harness({
    authRead: async () => session,
    env: { EXPO_PUBLIC_RC_ANDROID_KEY: 'public-sdk-key' },
    purchases: {
      configure() {}, logOut: async () => {},
      logIn: async id => { logins.push(id); },
      getCustomerInfo: async () => ({ entitlements: { active: { pro: {} } } }),
    },
  });
  await h.flush(); await h.flush();
  assert.deepEqual(logins, [session.user.id]);
  assert.equal(h.value().plan, 'pro');
  h.emitSession({ user: { ...session.user, name: 'Updated name' } });
  await h.flush(); await h.flush();
  assert.deepEqual(logins, [session.user.id], 'a same-account profile refresh does not change billing identity');
  h.emitSession(null);
  await h.flush();
  assert.equal(h.value().plan, 'free', 'sign-out never preserves the previous account entitlement');
  h.unmount();
});

test('slow billing identity changes settle in order and never apply the previous account entitlement', async () => {
  let finishFirstLogin;
  const calls = [];
  let sdkAccount;
  const h = harness({
    authRead: async () => ({ user: { id: 'member-a' } }),
    env: { EXPO_PUBLIC_RC_ANDROID_KEY: 'public-sdk-key' },
    purchases: {
      configure() {}, logOut: async () => {},
      logIn: async id => {
        calls.push(`start:${id}`);
        if (id === 'member-a') await new Promise(resolve => { finishFirstLogin = resolve; });
        sdkAccount = id; calls.push(`end:${id}`);
      },
      getCustomerInfo: async () => ({ entitlements: { active: sdkAccount === 'member-a' ? { elite: {} } : {} } }),
    },
  });
  await h.flush(); await h.flush();
  h.emitSession({ user: { id: 'member-b' } });
  await h.flush();
  assert.equal(h.value().plan, 'free');
  assert.deepEqual(calls, ['start:member-a']);
  finishFirstLogin();
  await h.flush(); await h.flush();
  assert.deepEqual(calls, ['start:member-a', 'end:member-a', 'start:member-b', 'end:member-b']);
  assert.equal(h.value().session.user.id, 'member-b');
  assert.equal(h.value().plan, 'free');
  h.unmount();
});

test('a failed billing login cannot read or grant another cached customer entitlement', async () => {
  let reads = 0;
  const h = harness({
    authRead: async () => ({ user: { id: 'member-a' } }),
    env: { EXPO_PUBLIC_RC_ANDROID_KEY: 'public-sdk-key' },
    purchases: {
      configure() {}, logOut: async () => {},
      logIn: async () => { throw new Error('Billing offline'); },
      getCustomerInfo: async () => { reads++; return { entitlements: { active: { elite: {} } } }; },
    },
  });
  await h.flush(); await h.flush();
  assert.equal(h.value().plan, 'free');
  await h.value().refreshPlan();
  await h.flush();
  assert.equal(reads, 0);
  h.unmount();
});

test('store preparation requires a signed-in account and retries a previously failed billing identity', async () => {
  const signedOut = harness({ env: { EXPO_PUBLIC_RC_ANDROID_KEY: 'public-sdk-key' } });
  await signedOut.flush();
  await assert.rejects(signedOut.value().preparePurchases(), /Sign in before/);
  signedOut.unmount();
  let offline = true;
  let attempts = 0;
  const h = harness({
    authRead: async () => ({ user: { id: 'member-a' } }),
    env: { EXPO_PUBLIC_RC_ANDROID_KEY: 'public-sdk-key' },
    purchases: {
      configure() {}, logOut: async () => {},
      logIn: async () => { attempts++; if (offline) throw new Error('Offline'); },
      getCustomerInfo: async () => ({ entitlements: { active: { pro: {} } } }),
    },
  });
  await h.flush(); await h.flush();
  await assert.rejects(h.value().preparePurchases(), /Purchases could not connect/);
  assert.equal(h.value().plan, 'free');
  offline = false;
  await h.value().preparePurchases();
  await h.value().refreshPlan();
  await h.flush();
  assert.equal(h.value().plan, 'pro');
  assert.equal(attempts, 3);
  h.unmount();
});
