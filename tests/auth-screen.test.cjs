const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise, Error, URL, process: { env: {} },
    require(name) {
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}

const native = {
  Platform: { OS: 'android' },
  StyleSheet: { create: value => value },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  ...Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Pressable', 'ScrollView', 'TextInput', 'View'].map(name => [name, name])),
};
const profile = load('src/lib/accountProfile.ts', {});
const registration = load('src/lib/registrationDetails.ts', {});
const { AccountAccessError, AccountVerificationError } = load('src/lib/neonAuth.ts', {
  'react-native-url-polyfill/auto': {},
  'react-native': native,
  './neonCookies': {},
  './startupTasks': {},
  './secureStorage': {},
  './accountProfile': profile,
});

function screen({ failureCode = 'EMAIL_NOT_VERIFIED', platform = 'android', socialEnabled = false, deliveryFailure = false } = {}) {
  const slots = [];
  let index = 0;
  let tree;
  let verified = false;
  const calls = [];
  const detailWrites = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const position = index++;
      if (!(position in slots)) slots[position] = typeof initial === 'function' ? initial() : initial;
      return [slots[position], value => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }];
    },
    useRef(initial) {
      const position = index++;
      return slots[position] ||= { current: initial };
    },
  };
  react.default = react;
  const { default: Auth } = load('src/app/auth.tsx', {
    react,
    'react-native': { ...native, Platform: { OS: platform } },
    'expo-router': { router: { push: () => { throw new Error('Unexpected navigation'); } } },
    '../components/ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../components/AppLogo': { AppLogo: 'AppLogo' },
    '../components/RegistrationFields': { RegistrationFields: 'RegistrationFields' },
    '../components/design': { Icon: 'Icon', Label: 'Label' },
    '../lib/session': { useSession: () => ({ authConfigured: true, startDemo: async () => {} }) },
    '../lib/workspace': { useWorkspace: () => ({ language: 'en', t: value => value }) },
    '../lib/languages': { languages: [{ code: 'en' }] },
    '../lib/theme': { fonts: { extraBold: 'test-font' }, ThemeSurface: 'ThemeSurface' },
    '../lib/authLinks': { authRedirectUri: () => 'pipwise://auth-callback' },
    '../lib/startupTasks': { withStartupTimeout: async task => task },
    '../lib/accountProfile': profile,
    '../lib/registrationDetails': registration,
    '../lib/accountDetails': { stageRegistrationDetails: async (email, details) => detailWrites.push({ email, details }), syncPendingRegistrationDetails: async () => {} },
    '../lib/neonAuth': {
      AccountAccessError,
      AccountVerificationError,
      googleAuthEnabled: socialEnabled,
      appleAuthEnabled: socialEnabled,
      async signInWithGoogle(callbackURL) { calls.push({ action: 'google', callbackURL }); },
      async signInWithApple(callbackURL) { calls.push({ action: 'apple', callbackURL }); },
      async signIn(email, password) {
        calls.push({ action: 'signIn', email, password });
        if (!verified) throw new AccountAccessError({ code: failureCode, message: failureCode === 'EMAIL_NOT_VERIFIED' ? 'Email is not verified' : 'Invalid email or password' });
        return { user: { id: 'returning-user', email } };
      },
      async verifyEmail(email, otp) { calls.push({ action: 'verifyEmail', email, otp }); verified = true; },
      async resendVerification(email) { calls.push({ action: 'resendVerification', email }); },
      async signUp(email, password, name) { calls.push({ action: 'signUp', email, password, name }); if (deliveryFailure) throw new AccountVerificationError(); return null; },
    },
  });
  const render = () => { index = 0; tree = Auth(); };
  function allNodes(value = tree) {
    if (Array.isArray(value)) return value.flatMap(item => allNodes(item));
    if (!value || typeof value !== 'object') return [];
    return [value, ...allNodes(value.props?.children)];
  }
  function find(label, role) {
    return allNodes().find(node => node.props?.accessibilityLabel === label && (!role || node.props.accessibilityRole === role));
  }
  function required(label, role) {
    const node = find(label, role);
    assert.ok(node, `${label} must be available`);
    return node;
  }
  render();
  return {
    calls, detailWrites, find,
    details(countryCode, phoneNumber = '') { const field = allNodes().find(node => node.type === 'RegistrationFields'); assert.ok(field); field.props.onCountryChange(countryCode); field.props.onPhoneChange(phoneNumber); render(); },
    enter(label, value) { required(label).props.onChangeText(value); render(); },
    async press(label) { await required(label, 'button').props.onPress(); render(); },
    tab(label) { required(label, 'tab').props.onPress(); render(); },
    text: () => JSON.stringify(tree),
  };
}

test('a returning unverified user can resume email confirmation from a fresh sign-in screen', async () => {
  const fixture = screen();
  assert.equal(fixture.find('Email confirmation code'), undefined);
  fixture.enter('Email address', ' returning@example.test ');
  fixture.enter('Password', 'example-password');
  await fixture.press('Sign in');
  assert.deepEqual(fixture.calls, [{ action: 'signIn', email: 'returning@example.test', password: 'example-password' }]);
  assert.ok(fixture.find('Email confirmation code'));
  assert.ok(fixture.find('Verify email', 'button'));
  assert.ok(fixture.find('Resend confirmation email', 'button'));
  assert.match(fixture.text(), /Confirm your email to finish signing in/);

  await fixture.press('Resend confirmation email');
  assert.deepEqual(fixture.calls.at(-1), { action: 'resendVerification', email: 'returning@example.test' });
  fixture.enter('Email confirmation code', ' 123456 ');
  await fixture.press('Verify email');
  assert.deepEqual(fixture.calls.slice(-2), [
    { action: 'verifyEmail', email: 'returning@example.test', otp: '123456' },
    { action: 'signIn', email: 'returning@example.test', password: 'example-password' },
  ]);
  assert.equal(fixture.find('Email confirmation code'), undefined);
  assert.equal(fixture.find('Resend confirmation email', 'button'), undefined);
});

test('sign-up requires a name, stores normalized Unicode text, and keeps verification available', async () => {
  const fixture = screen();
  assert.equal(fixture.find('Full name'), undefined, 'sign-in must not require a profile name');
  fixture.tab('Create account');
  assert.equal(fixture.find('Full name').props.autoComplete, 'name');
  assert.equal(fixture.find('Full name').props.maxLength, 80);
  fixture.enter('Email address', ' new@example.test ');
  fixture.enter('Password', 'example-password');
  await fixture.press('Create account');
  assert.match(fixture.text(), /Enter your name/);
  assert.deepEqual(fixture.calls, [], 'missing name must not call the account API');
  fixture.enter('Full name', '  ናትናኤል\u00a0  ተስፋዬ  ');
  fixture.details('ET', '+251 912 345 678');
  await fixture.press('Create account');
  assert.deepEqual(fixture.calls, [{ action: 'signUp', email: 'new@example.test', password: 'example-password', name: 'ናትናኤል ተስፋዬ' }]);
  assert.equal(fixture.detailWrites[0].details.countryCode, 'ET');
  assert.equal(fixture.detailWrites[0].details.phoneNumber, '+251912345678');
  assert.ok(fixture.find('Email confirmation code'));
  assert.match(fixture.text(), /Check your email for a confirmation code/);
  fixture.tab('Sign in');
  assert.equal(fixture.find('Full name'), undefined);
});

test('sign-up rejects control characters without sending profile details to the account API', async () => {
  const fixture = screen();
  fixture.tab('Create account');
  fixture.enter('Email address', 'new@example.test');
  fixture.enter('Password', 'example-password');
  fixture.enter('Full name', 'Name\u0000Hidden');
  await fixture.press('Create account');
  assert.match(fixture.text(), /without line breaks or control characters/);
  assert.deepEqual(fixture.calls, []);
});

test('signup requires country and validates a supplied contact phone before creating any account', async () => {
  const fixture = screen();
  fixture.tab('Create account');
  fixture.enter('Full name', 'New member');
  fixture.enter('Email address', 'new@example.test');
  fixture.enter('Password', 'example-password');
  await fixture.press('Create account');
  assert.match(fixture.text(), /Choose your country or region/);
  assert.equal(fixture.calls.length, 0);
  fixture.details('ET', '+12025550123');
  await fixture.press('Create account');
  assert.match(fixture.text(), /\+251 calling code/);
  assert.equal(fixture.calls.length, 0);
  fixture.details('ET');
  await fixture.press('Create account');
  assert.equal(fixture.calls[0].action, 'signUp');
  assert.equal(fixture.detailWrites[0].details.phoneNumber, null);
});

test('an account created before email delivery failed keeps resend available and prevents duplicate registration', async () => {
  const fixture = screen({ deliveryFailure: true });
  fixture.tab('Create account');
  fixture.enter('Full name', 'New member');
  fixture.enter('Email address', 'new@example.test');
  fixture.enter('Password', 'example-password');
  fixture.details('ET');
  await fixture.press('Create account');
  assert.ok(fixture.find('Email confirmation code'));
  assert.match(fixture.text(), /Your account was created/);
  assert.equal(fixture.find('Create account', 'button').props.disabled, true);
  await fixture.press('Create account');
  assert.equal(fixture.calls.filter(item => item.action === 'signUp').length, 1);
  await fixture.press('Resend confirmation email');
  assert.equal(fixture.calls.at(-1).action, 'resendVerification');
});

test('invalid credentials show their error without opening email verification controls', async () => {
  const fixture = screen({ failureCode: 'INVALID_EMAIL_OR_PASSWORD' });
  fixture.enter('Email address', 'returning@example.test');
  fixture.enter('Password', 'incorrect-password');
  await fixture.press('Sign in');
  assert.match(fixture.text(), /Invalid email or password/);
  assert.equal(fixture.find('Email confirmation code'), undefined);
  assert.equal(fixture.find('Verify email', 'button'), undefined);
  assert.equal(fixture.find('Resend confirmation email', 'button'), undefined);
  assert.equal(fixture.calls.length, 1);
});

test('configured Google sign-in is available on mobile and Apple is available on iOS', async () => {
  const android = screen({ socialEnabled: true });
  await android.press('Continue with Google');
  assert.equal(android.calls[0].action, 'google');
  assert.equal(android.find('Continue with Apple', 'button'), undefined);
  const ios = screen({ platform: 'ios', socialEnabled: true });
  await ios.press('Continue with Google');
  await ios.press('Continue with Apple');
  assert.deepEqual(ios.calls.map(call => call.action), ['google', 'apple']);
  const disabled = screen();
  assert.equal(disabled.find('Continue with Google', 'button'), undefined);
  assert.equal(disabled.find('Continue with Apple', 'button'), undefined);
});
