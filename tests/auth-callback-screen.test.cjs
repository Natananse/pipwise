const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function screen({ params = {}, linkedUrl = null, platform = 'android', browserUrl, validate = async () => ({ recovery: false }) } = {}) {
  const slots = [];
  const calls = [];
  const navigations = [];
  const cleanups = [];
  let index = 0;
  let effects = [];
  let tree;
  const beginPasswordRecovery = () => {};
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const position = index++;
      const slot = slots[position] ||= { value: initial };
      return [slot.value, value => { slot.value = typeof value === 'function' ? value(slot.value) : value; }];
    },
    useEffect(effect, dependencies) {
      const position = index++;
      const previous = slots[position];
      if (!previous || dependencies.some((dependency, i) => dependency !== previous.dependencies[i])) {
        const slot = { dependencies, cleanup: previous?.cleanup };
        slots[position] = slot;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); cleanups.push(slot); });
      }
    },
  };
  react.default = react;
  const imports = {
    react,
    'expo-linking': { useURL: () => linkedUrl },
    'expo-web-browser': { maybeCompleteAuthSession: () => {} },
    'expo-router': { router: { replace: target => navigations.push(target) }, useLocalSearchParams: () => params },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: platform }, View: 'View' },
    '../components/AuthFlowScreen': { AuthFlowScreen: 'AuthFlowScreen' },
    '../components/design': { AppButton: 'AppButton', Label: 'Label' },
    '../lib/authLinks': { completeAuthCallback: async url => { calls.push(url); return validate(url); } },
    '../lib/session': { useSession: () => ({ beginPasswordRecovery }) },
    '../lib/neonAuth': { cancelNativeAuth: async () => {} },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/auth-callback.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise, Error, URLSearchParams, setTimeout, clearTimeout,
    ...(browserUrl ? { window: { location: { href: browserUrl } } } : {}),
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  }, { filename: 'src/app/auth-callback.tsx' });
  function render() {
    index = 0;
    effects = [];
    tree = module.exports.default();
    for (const effect of effects) effect();
  }
  render();
  return {
    calls, navigations,
    async flush() { await new Promise(resolve => setImmediate(resolve)); render(); },
    async updateLink(url) { linkedUrl = url; render(); await this.flush(); },
    text: () => JSON.stringify(tree),
    unmount() { for (const slot of cleanups) slot.cleanup?.(); },
  };
}

test('current native callback parameters override a stale link from the original app launch', async () => {
  const fixture = screen({
    linkedUrl: 'pipwise://auth-callback?state=stale-state&neon_auth_session_verifier=stale-verifier',
    params: { state: 'current-state', neon_auth_session_verifier: 'current+/=' },
  });
  await fixture.flush();
  assert.equal(fixture.calls.length, 1);
  const actual = new URL(fixture.calls[0]);
  assert.equal(actual.protocol, 'pipwise:');
  assert.equal(actual.hostname, 'auth-callback');
  assert.equal(actual.searchParams.get('state'), 'current-state');
  assert.equal(actual.searchParams.get('neon_auth_session_verifier'), 'current+/=');
  assert.deepEqual(fixture.navigations, ['/auth']);
  fixture.unmount();
});

test('a delayed stale initial link cannot replace or restart current callback validation', async () => {
  const fixture = screen({ params: { state: 'current-state', neon_auth_session_verifier: 'current-verifier' } });
  await fixture.updateLink('pipwise://practice?old=launch');
  assert.equal(fixture.calls.length, 1);
  assert.equal(new URL(fixture.calls[0]).searchParams.get('state'), 'current-state');
  fixture.unmount();
});

test('duplicate route parameters reach validation intact and cannot be silently accepted', async () => {
  const fixture = screen({
    params: { state: ['first-state', 'second-state'], neon_auth_session_verifier: ['first-verifier', 'second-verifier'] },
    validate: async url => {
      const params = new URL(url).searchParams;
      assert.deepEqual(params.getAll('state'), ['first-state', 'second-state']);
      assert.deepEqual(params.getAll('neon_auth_session_verifier'), ['first-verifier', 'second-verifier']);
      throw new Error('Duplicate account callback parameters');
    },
  });
  await fixture.flush();
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.navigations, []);
  assert.match(fixture.text(), /Duplicate account callback parameters/);
  fixture.unmount();
});

test('raw linking URL remains a fallback, while web uses the browser callback URL', async () => {
  const raw = 'pipwise://auth-callback?state=raw-state&neon_auth_session_verifier=raw-verifier';
  const native = screen({ linkedUrl: raw });
  await native.flush();
  assert.deepEqual(native.calls, [raw]);
  native.unmount();
  const browserUrl = 'https://app.example.test/auth-callback?neon_auth_session_verifier=browser-verifier';
  const web = screen({ platform: 'web', browserUrl, linkedUrl: raw, params: { state: 'ignored-native-state' } });
  await web.flush();
  assert.deepEqual(web.calls, [browserUrl]);
  web.unmount();
});

test('successful native deletion reauthentication returns to the allowlisted deletion page', async () => {
  const fixture = screen({ params: { state: 'current-state', neon_auth_session_verifier: 'current-verifier' }, validate: async () => ({ recovery: false, destination: '/delete-account' }) });
  await fixture.flush();
  assert.deepEqual(fixture.navigations, ['/delete-account']);
  fixture.unmount();
});

test('other destination strings cannot redirect the callback screen', async () => {
  for (const destination of ['https://untrusted.example.test', '//untrusted.example.test', '/settings', '/delete-account?next=external']) {
    const fixture = screen({ params: { state: 'current-state', neon_auth_session_verifier: 'current-verifier' }, validate: async () => ({ recovery: false, destination }) });
    await fixture.flush();
    assert.deepEqual(fixture.navigations, ['/auth']);
    fixture.unmount();
  }
});
