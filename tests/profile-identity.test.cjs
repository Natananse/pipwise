const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise, Error,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}
const names = load('src/lib/accountProfile.ts');
const registration = load('src/lib/registrationDetails.ts');
const { resolveProfileIdentity } = load('src/lib/profileIdentity.ts', { './accountProfile': names });
const member = { user: { id: 'member-a', name: '  ናትናኤል  Tesfaye  ', email: 'member@example.test' } };

test('authenticated identity uses the account name and ignores legacy or another account local names', () => {
  for (const accountId of [undefined, 'member-b', 'member-a']) {
    const identity = resolveProfileIdentity(member, { displayName: 'Another person', avatarId: 'owl', ...(accountId ? { accountId } : {}) });
    assert.equal(identity.displayName, 'ናትናኤል Tesfaye');
    assert.equal(identity.editableName, 'ናትናኤል Tesfaye');
    assert.equal(identity.email, member.user.email);
    assert.equal(identity.avatarId, accountId === 'member-a' ? 'owl' : 'trader');
  }
});

test('signed-out demo does not expose a previous signed-in account profile', () => {
  const identity = resolveProfileIdentity(null, { displayName: 'Previous account', avatarId: 'bull', accountId: 'member-a' });
  assert.equal(identity.displayName, 'Practice trader');
  assert.equal(identity.editableName, '');
  assert.equal(identity.avatarId, 'trader');
  assert.equal(identity.email, '');
  const local = resolveProfileIdentity(null, { displayName: '  Local  trader ', avatarId: 'bull' });
  assert.equal(local.displayName, 'Local trader');
  assert.equal(local.avatarId, 'bull');
});

test('invalid or missing account names use a safe member fallback without leaking email or local aliases', () => {
  for (const name of [undefined, '', 'Name\nInjected']) {
    const identity = resolveProfileIdentity({ user: { id: 'member-a', name, email: 'private@example.test' } }, { displayName: 'Another person', avatarId: 'owl', accountId: 'member-a' });
    assert.equal(identity.displayName, 'PipWise member');
    assert.equal(identity.editableName, '');
  }
});

test('workspace accepts legacy profiles and validates account ownership without clearing wallet or progress', () => {
  const wallet = { cash: 4321, positions: [], history: [] };
  const { parseWorkspaceData } = load('src/lib/workspace.tsx', {
    react: { createContext: () => ({}) }, '@react-native-async-storage/async-storage': {},
    './simulator': { initialWallet: { cash: 10000, positions: [], history: [] } },
    './persistence': {}, './languages': { isLanguage: () => true }, './translations': {}, './startupTasks': {},
    './demoMarket': {}, './demoMarketProvider': {},
    './walletPersistence': load('src/lib/walletPersistence.ts', { './market': load('src/lib/market.ts') }),
  });
  const saved = { wallet, completed: ['saved-lesson'], profile: { displayName: 'Local trader', avatarId: 'owl' } };
  const legacy = parseWorkspaceData(JSON.stringify(saved));
  assert.equal(legacy.wallet.cash, 4321);
  assert.equal(legacy.completed[0], 'saved-lesson');
  assert.equal(legacy.profile.accountId, undefined);
  assert.equal(parseWorkspaceData(JSON.stringify({ ...saved, profile: { ...saved.profile, accountId: member.user.id } })).profile.accountId, member.user.id);
  for (const accountId of ['', null, 42, 'x'.repeat(257), 'member\nInjected']) {
    assert.throws(() => parseWorkspaceData(JSON.stringify({ ...saved, profile: { ...saved.profile, accountId } })), /Invalid saved profile/);
  }
});

function profileHarness() {
  const slots = [];
  let cursor = 0;
  const writes = [];
  const requests = [];
  const deadlines = [];
  const detailWrites = [];
  let details = { countryCode: 'ET', phoneNumber: '+251912345678' };
  let loadDetails = async () => details;
  let saveDetails = async value => value;
  let session = member;
  let save = async name => ({ user: { id: member.user.id, name, email: member.user.email } });
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(value) { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, position) => !Object.is(previous.dependencies[position], value))) {
        previous?.cleanup?.();
        slots[index] = { dependencies, cleanup: callback() };
      }
    },
  };
  react.default = react;
  const workspace = {
    wallet: { cash: 10000, positions: [], history: [] }, completed: [],
    profile: { displayName: 'Previous account name', avatarId: 'owl', accountId: 'member-b' },
    preferences: { experience: 'Beginner', markets: ['Forex', 'Gold'], goal: 'Build confidence' }, language: 'am',
    update: patch => writes.push(patch), storageError: '',
  };
  const api = load('src/app/(tabs)/profile.tsx', {
    react,
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { router: { push() {} } },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Rect: 'Rect', Stop: 'Stop' },
    '../../components/AvatarPortrait': { AvatarPortrait: 'AvatarPortrait' },
    '../../components/RegistrationFields': { RegistrationFields: 'RegistrationFields' },
    '../../components/ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
    '../../components/design': { AppButton: 'AppButton', AppInput: 'AppInput', Icon: 'Icon', Label: 'Label', Sheet: 'Sheet' },
    '../../components/reference': { referenceColors: { bg: 'white', ink: 'black', charcoal: '#111111', mint: '#00ffaa', muted: '#555555', line: '#dddddd' } },
    '../../lib/lessons': { lessons: [] },
    '../../lib/accountProfile': names,
    '../../lib/accountDetails': { getAccountDetails: () => loadDetails(), syncPendingRegistrationDetails: async () => {}, saveAccountDetails: async value => { detailWrites.push(value); return saveDetails(value); } },
    '../../lib/registrationDetails': registration,
    '../../lib/demoMarketProvider': { useDemoMarket: () => ({ quotes: {}, ready: true }) },
    '../../lib/languages': { languageInfo: () => ({ nativeName: 'አማርኛ' }) },
    '../../lib/navigation': load('src/lib/navigation.ts'),
    '../../lib/responsiveLayout': load('src/lib/responsiveLayout.ts'),
    '../../lib/market': { money: value => `$${value}` },
    '../../lib/neonAuth': { updateDisplayName: async name => { requests.push(name); return save(name); } },
    '../../lib/profileIdentity': { resolveProfileIdentity },
    '../../lib/session': { useSession: () => ({ session, demo: false, plan: 'free', accountDetailsError: '', retryAccountDetails: async () => {} }) },
    '../../lib/startupTasks': { withStartupTimeout: (promise, _message, timeoutMs) => { deadlines.push(timeoutMs); return promise; } },
    '../../lib/simulator': { initialWallet: { cash: 10000 }, summary: () => ({ equity: 10000 }), pnl: () => 0 },
    '../../lib/theme': { fonts: {}, ThemeSurface: ({ children }) => children },
    '../../lib/workspace': { useWorkspace: () => workspace },
  });
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.type === 'function') return expand(value.type(value.props));
    return { ...value, props: { ...value.props, children: expand(value.props.children) } };
  }
  const render = () => { cursor = 0; return expand(api.default()); };
  return { render, requests, writes, deadlines, detailWrites, setLoadDetails: next => { loadDetails = next; }, setSaveDetails: next => { saveDetails = next; }, setDetails: next => { details = next; }, setSave: next => { save = next; }, setSession: next => { session = next; } };
}
function find(tree, predicate) {
  if (Array.isArray(tree)) { for (const child of tree) { const result = find(child, predicate); if (result) return result; } return null; }
  if (!tree || typeof tree !== 'object') return null;
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
function texts(tree) {
  if (Array.isArray(tree)) return tree.map(texts).join(' ');
  if (typeof tree === 'string') return tree;
  return tree && typeof tree === 'object' ? texts(tree.props?.children) : '';
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('profile editor keeps a failed remote update open and never reports local-only success', async () => {
  const h = profileHarness();
  let reject;
  h.setSave(() => new Promise((_resolve, fail) => { reject = fail; }));
  let tree = h.render();
  await flush(); tree = h.render();
  assert.ok(texts(tree).includes('member@example.test'));
  assert.ok(texts(tree).includes('Build confidence'));
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppInput' && item.props.label === 'Full name').props.onChangeText('  New  Name ');
  tree = h.render();
  const save = find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile');
  save.props.onPress();
  save.props.onPress();
  tree = h.render();
  assert.deepEqual(h.requests, ['New Name']);
  assert.deepEqual(h.deadlines, [25000], 'UI wait must allow both bounded 10-second SDK requests to settle first');
  assert.equal(find(tree, item => item.type === 'AppInput').props.editable, false);
  assert.equal(h.writes.length, 0);
  reject(new Error('Could not update your account. Try again.'));
  await flush();
  tree = h.render();
  assert.equal(find(tree, item => item.type === 'Sheet' && item.props.title === 'Edit your profile').props.visible, true);
  assert.ok(texts(tree).includes('Could not update your account. Try again.'));
  assert.equal(h.writes.length, 0);
});

test('profile editor commits account-owned local avatar only after canonical remote success', async () => {
  const h = profileHarness();
  h.setSave(async () => ({ user: { id: member.user.id, name: 'Canonical Name', email: member.user.email } }));
  let tree = h.render();
  await flush(); tree = h.render();
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppInput').props.onChangeText('New Name');
  find(tree, item => item.props.accessibilityLabel === 'bull avatar').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile').props.onPress();
  await flush();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].profile.displayName, 'Canonical Name');
  assert.equal(h.writes[0].profile.accountId, member.user.id);
  assert.equal(h.writes[0].profile.avatarId, 'bull');
  assert.equal(find(h.render(), item => item.type === 'Sheet' && item.props.title === 'Edit your profile').props.visible, false);
});

test('changing accounts while the editor is open cannot submit the previous account draft', async () => {
  const h = profileHarness();
  let tree = h.render();
  await flush(); tree = h.render();
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  h.setSession({ user: { id: 'member-b', name: 'Other account', email: 'other@example.test' } });
  tree = h.render();
  find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile').props.onPress();
  await flush();
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.length, 0);
  assert.ok(texts(h.render()).includes('Your account changed. Reopen the profile editor to continue.'));
});

test('a contact-storage outage preserves name editing without overwriting unknown country or phone', async () => {
  const h = profileHarness();
  h.setLoadDetails(async () => { throw new Error('Account profile storage is unavailable.'); });
  h.render(); await flush();
  let tree = h.render();
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  tree = h.render();
  assert.equal(find(tree, item => item.type === 'RegistrationFields').props.disabled, true);
  assert.match(texts(tree), /saved country and phone will be preserved/);
  find(tree, item => item.type === 'AppInput' && item.props.label === 'Full name').props.onChangeText('Updated member');
  tree = h.render();
  find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile').props.onPress();
  await flush();
  assert.deepEqual(h.requests, ['Updated member']);
  assert.equal(h.detailWrites.length, 0);
  assert.equal(h.writes.length, 1);
  assert.equal(find(h.render(), item => item.type === 'Sheet' && item.props.title === 'Edit your profile').props.visible, false);
});

test('an account with no saved contacts can update its name and avatar without being forced to add a country', async () => {
  const h = profileHarness();
  h.setDetails(null);
  h.render(); await flush();
  let tree = h.render();
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppInput' && item.props.label === 'Full name').props.onChangeText('Updated member');
  find(tree, item => item.props.accessibilityLabel === 'bull avatar').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile').props.onPress();
  await flush();
  assert.deepEqual(h.requests, ['Updated member']);
  assert.equal(h.detailWrites.length, 0);
  assert.equal(h.writes[0].profile.avatarId, 'bull');
  assert.equal(find(h.render(), item => item.type === 'Sheet' && item.props.title === 'Edit your profile').props.visible, false);
});

test('an untouched contact form does not rewrite existing country or phone during a name change', async () => {
  const h = profileHarness();
  h.setSaveDetails(async () => { throw new Error('Contact service unavailable'); });
  h.render(); await flush();
  let tree = h.render();
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppInput' && item.props.label === 'Full name').props.onChangeText('Updated member');
  tree = h.render();
  find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile').props.onPress();
  await flush();
  assert.equal(h.detailWrites.length, 0);
  assert.equal(h.writes.length, 1);
  assert.equal(find(h.render(), item => item.type === 'Sheet' && item.props.title === 'Edit your profile').props.visible, false);
});

test('a partial profile save explains the saved name and leaves unsaved contact changes available to retry', async () => {
  const h = profileHarness();
  h.setSaveDetails(async () => { throw new Error('Please try again.'); });
  h.render(); await flush();
  let tree = h.render();
  find(tree, item => item.props.accessibilityLabel === 'Edit profile information').props.onPress();
  tree = h.render();
  find(tree, item => item.type === 'AppInput' && item.props.label === 'Full name').props.onChangeText('Updated member');
  const fields = find(tree, item => item.type === 'RegistrationFields');
  fields.props.onCountryChange('US'); fields.props.onPhoneChange('');
  tree = h.render();
  find(tree, item => item.type === 'AppButton' && item.props.label === 'Save profile').props.onPress();
  await flush();
  tree = h.render();
  assert.match(texts(tree), /Your name was saved, but your contact details were not/);
  assert.equal(find(tree, item => item.type === 'Sheet' && item.props.title === 'Edit your profile').props.visible, true);
  assert.equal(find(tree, item => item.type === 'RegistrationFields').props.countryCode, 'US');
  assert.equal(h.writes.length, 0, 'avatar changes remain uncommitted until both remote saves succeed');
});

test('a delayed contact response from a previous account cannot expose its phone after switching accounts', async () => {
  const h = profileHarness();
  let release;
  let reads = 0;
  h.setLoadDetails(() => ++reads === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ countryCode: 'US', phoneNumber: null }));
  h.render(); await flush();
  h.setSession({ user: { id: 'member-b', name: 'Other member', email: 'other@example.test' } });
  h.render(); await flush();
  release({ countryCode: 'ET', phoneNumber: '+251912345678' });
  await flush();
  const tree = h.render();
  assert.match(texts(tree), /United States/);
  assert.doesNotMatch(texts(tree), /\+251912345678/);
});
