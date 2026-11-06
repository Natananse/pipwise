const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function page({ signedIn = true, deletionError, clearFailures = 0 } = {}) {
  let session = signedIn ? { user: { id: 'account-a', email: 'person@example.test' } } : null;
  const calls = [];
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];
  let tree;
  class AccountAccessError extends Error {}
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value }; },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        slots[index] = { dependencies };
        pendingEffects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  react.default = react;
  const imports = {
    react,
    'expo-router': { router: { replace: value => calls.push(['route', value]) } },
    'react-native': { Platform: { OS: 'web' }, View: 'View', Linking: { openURL: async value => calls.push(['email', value]) } },
    '../components/design': { AppButton: 'AppButton', AppInput: 'AppInput', Label: 'Label' },
    '../components/LegalPage': { LegalPage: 'LegalPage', LegalSection: 'LegalSection', LegalText: 'LegalText' },
    '../lib/accountDeletion': { async requestAccountDeletion(accountId) { calls.push(['delete', accountId]); if (deletionError) throw deletionError; } },
    '../lib/authLinks': { authRedirectUri: () => 'pipwise://auth-callback', completeAuthCallback: async () => {} },
    '../lib/neonAuth': {
      AccountAccessError, googleAuthEnabled: false,
      async signIn(email) { calls.push(['sign-in', email]); session = { user: { id: 'account-a', email } }; return session; },
      requestPasswordReset: async () => {}, resendVerification: async () => {}, resetPassword: async () => {}, signInWithGoogle: async () => {}, verifyEmail: async () => {},
    },
    '../lib/session': { useSession: () => ({
      ready: true, session, authConfigured: true, initializationError: '', retryInitialization() {},
      async finishAccountDeletion() { calls.push(['clear']); if (clearFailures-- > 0) throw new Error('Storage failed'); session = null; },
      async signOut() { session = null; },
    }) },
    '../lib/startupTasks': { withStartupTimeout: async promise => promise },
    '../lib/legal': { legalDetails: { contactEmail: 'pipswise1@gmail.com' } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/delete-account.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Error, Promise, URLSearchParams,
    require(name) { assert.ok(name in imports, `Unexpected import: ${name}`); return imports[name]; },
  });
  function nodes(value = tree) {
    if (Array.isArray(value)) return value.flatMap(item => nodes(item));
    return value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : [];
  }
  function text(value = tree) {
    if (Array.isArray(value)) return value.map(item => text(item)).join(' ');
    return typeof value === 'string' ? value : value && typeof value === 'object' ? text(value.props?.children) : '';
  }
  function render() { cursor = 0; pendingEffects = []; tree = module.exports.default(); pendingEffects.forEach(effect => effect()); }
  render();
  return {
    calls, text,
    setAccount(value) { session = value; render(); render(); },
    input(label, value) { const node = nodes().find(node => node.type === 'AppInput' && node.props.label === label); assert.ok(node, `Missing input: ${label}`); node.props.onChangeText(value); render(); },
    async press(label, { force = false } = {}) {
      const node = nodes().find(node => node.type === 'AppButton' && node.props.label === label);
      assert.ok(node, `Missing button: ${label}`);
      if (!force) assert.equal(Boolean(node.props.disabled || node.props.busy), false, `Button disabled: ${label}`);
      node.props.onPress();
      await new Promise(resolve => setImmediate(resolve));
      render(); render();
    },
  };
}

test('public deletion requires account access and explicit confirmation', async () => {
  const h = page({ signedIn: false });
  assert.match(h.text(), /never asks for payment information or a new account/);
  h.input('Account email', 'person@example.test');
  h.input('Account password', 'correct-test-password');
  await h.press('Sign in to manage deletion');
  assert.deepEqual(h.calls, [['sign-in', 'person@example.test']]);
  await h.press('Permanently delete account', { force: true });
  assert.deepEqual(h.calls, [['sign-in', 'person@example.test']]);
  assert.match(h.text(), /Type DELETE exactly/);
  h.input('Type DELETE to confirm', 'DELETE');
  await h.press('Permanently delete account');
  assert.deepEqual(h.calls, [['sign-in', 'person@example.test'], ['delete', 'account-a'], ['clear']]);
  assert.match(h.text(), /Your PipWise account and associated active service data have been deleted/);
});

test('public instructions offer the owner contact without requiring account access', async () => {
  const h = page({ signedIn: false });
  assert.match(h.text(), /pipswise1@gmail.com/);
  await h.press('Email a deletion request');
  assert.deepEqual(h.calls, [['email', 'mailto:pipswise1@gmail.com?subject=PipWise%20account%20deletion']]);
});

test('a server rejection preserves the account and never clears local data', async () => {
  const h = page({ deletionError: new Error('Service unavailable') });
  h.input('Type DELETE to confirm', 'DELETE');
  await h.press('Permanently delete account');
  assert.deepEqual(h.calls, [['delete', 'account-a']]);
  assert.match(h.text(), /Service unavailable/);
  assert.doesNotMatch(h.text(), /Your PipWise account and associated active service data have been deleted/);
});

test('after server deletion, local cleanup retry never resubmits destructive deletion', async () => {
  const h = page({ clearFailures: 1 });
  h.input('Type DELETE to confirm', 'DELETE');
  await h.press('Permanently delete account');
  assert.deepEqual(h.calls, [['delete', 'account-a'], ['clear']]);
  assert.match(h.text(), /Your account was deleted/);
  await h.press('Finish clearing this device');
  assert.deepEqual(h.calls, [['delete', 'account-a'], ['clear'], ['clear']]);
  await h.press('Return to onboarding');
  assert.deepEqual(h.calls.at(-1), ['route', '/onboarding']);
});

test('switching accounts resets the destructive confirmation', async () => {
  const h = page();
  h.input('Type DELETE to confirm', 'DELETE');
  h.setAccount({ user: { id: 'account-b', email: 'other@example.test' } });
  await h.press('Permanently delete account', { force: true });
  assert.deepEqual(h.calls, []);
});

test('expired recent authentication reveals sign-in without clearing or deleting the account', async () => {
  const failure = Object.assign(new Error('Sign in again before deleting your account.'), { code: 'REAUTHENTICATION_REQUIRED' });
  const h = page({ deletionError: failure });
  h.input('Type DELETE to confirm', 'DELETE');
  await h.press('Permanently delete account');
  assert.deepEqual(h.calls, [['delete', 'account-a']]);
  assert.match(h.text(), /For your security, sign in again/);
  h.input('Account password', 'correct-test-password');
  await h.press('Sign in to manage deletion');
  assert.deepEqual(h.calls.at(-1), ['sign-in', 'person@example.test']);
});
