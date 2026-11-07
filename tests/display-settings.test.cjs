const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props.children)] : [];
}
function fixture() {
  const calls = [];
  const display = { loaded: true, rotation: 'auto', immersive: true, saving: false, error: '',
    async setRotation(value) { calls.push(['rotation', value]); display.rotation = value; },
    async setImmersive(value) { calls.push(['immersive', value]); display.immersive = value; },
    async retry() { calls.push(['preferences-retry']); } };
  let nativeError = '', tree;
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }) };
  react.default = react;
  const imports = {
    react, 'expo-router': { router: { push() {}, replace() {} } },
    'react-native': { Platform: { OS: 'android' }, Pressable: 'Pressable', View: 'View' },
    '../components/design': Object.fromEntries(['AppButton', 'AppInput', 'ConfirmationDialog', 'Label', 'Sheet'].map(name => [name, name])),
    '../components/BuildIdentity': { BuildIdentity: 'BuildIdentity' },
    '../components/LanguageSelector': { LanguageSelector: 'LanguageSelector' },
    '../components/reference': { ReferenceCard: 'ReferenceCard', ReferenceScreen: 'ReferenceScreen', referenceColors: { blue: '#125', line: '#ddd', red: '#a00' } },
    '../lib/onboarding': { onboardingText: (_language, value) => value },
    '../lib/session': { useSession: () => ({ demo: true, session: null }) },
    '../lib/workspace': { useWorkspace: () => ({ language: 'en', preferences: { goal: 'Learn' }, update() {} }) },
    '../lib/accountDeletion': { AccountDeletionError: class extends Error {}, requestAccountDeletion() {} },
    '../lib/neonAuth': { googleAuthEnabled: false },
    '../lib/uiPreferences': { useUiPreferences: () => display },
    '../components/OrientationCoordinator': { useOrientationStatus: () => ({ error: nativeError }), retryOrientation() { calls.push(['native-retry']); } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/settings.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText,
    { module, exports: module.exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  const render = () => { tree = module.exports.default(); };
  render();
  return { calls, display, render,
    all: () => nodes(tree),
    control: label => nodes(tree).find(node => node.props.accessibilityLabel === label),
    button: label => nodes(tree).find(node => node.type === 'AppButton' && node.props.label === label),
    nativeError(message) { nativeError = message; render(); },
  };
}

test('Settings presents accessible rotation choices and the durable immersive preference', async () => {
  const h = fixture();
  assert.equal(h.control('Auto-rotate').props.accessibilityRole, 'radio');
  assert.equal(h.control('Auto-rotate').props.accessibilityState.checked, true);
  assert.equal(h.control('Portrait only').props.accessibilityState.checked, false);
  assert.equal(h.control('Immersive mode').props.accessibilityRole, 'switch');
  assert.equal(h.control('Immersive mode').props.accessibilityState.checked, true);
  h.control('Portrait only').props.onPress(); await Promise.resolve(); h.render();
  assert.deepEqual(h.calls[0], ['rotation', 'portrait']);
  assert.equal(h.control('Portrait only').props.accessibilityState.checked, true);
  h.control('Immersive mode').props.onPress(); await Promise.resolve(); h.render();
  assert.deepEqual(h.calls[1], ['immersive', false]);
  assert.equal(h.control('Immersive mode').props.accessibilityState.checked, false);
});

test('loading/saving disables changes and native retries do not rerun storage or onboarding', () => {
  const h = fixture();
  for (const patch of [{ loaded: false }, { loaded: true, saving: true }]) {
    Object.assign(h.display, patch); h.render();
    for (const label of ['Auto-rotate', 'Portrait only', 'Immersive mode']) {
      assert.equal(h.control(label).props.disabled, true);
      assert.equal(h.control(label).props.accessibilityState.disabled, true);
    }
  }
  Object.assign(h.display, { loaded: false, saving: false, error: 'Could not load display preferences.' }); h.render();
  assert.ok(h.all().some(node => node.props.accessibilityRole === 'alert'));
  h.button('Retry display preferences').props.onPress();
  h.nativeError('Rotation could not be updated.'); h.button('Retry screen rotation').props.onPress();
  assert.deepEqual(h.calls, [['preferences-retry'], ['native-retry']]);
});
