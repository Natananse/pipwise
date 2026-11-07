const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return module.exports;
}

function harness(platform = 'android') {
  const overrides = load('src/lib/systemBarOverrides.ts');
  let focused = true;
  const effects = [];
  const backgrounds = [];
  const bars = load('src/components/ScreenSystemBars.tsx', {
    react: { ...React, default: React, useEffect: effect => effects.push(effect), useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'expo-router': { useIsFocused: () => focused },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-navigation-bar': { NavigationBar: 'NavigationBar' },
    'expo-system-ui': { setBackgroundColorAsync: async color => backgrounds.push(color) },
    'react-native': { Platform: { OS: platform } },
    '../lib/systemBarOverrides': overrides,
    '../lib/tradeChrome': { tradeChrome: { subscribe: () => () => {}, getSnapshot: () => ({ active: false, enabled: false, hidden: false }) } },
  });
  return { ...bars, backgrounds, effects, focus(value) { focused = value; } };
}

test('a kept-alive blurred route releases both bars and does not change the window background', () => {
  const h = harness();
  h.focus(false);
  assert.equal(h.ScreenSystemBars({ style: 'light', backgroundColor: '#0C100F' }), null);
  assert.equal(h.effects.length, 0);
  h.focus(true);
  const owner = h.ScreenSystemBars({ style: 'light', navigationStyle: 'dark', backgroundColor: '#F4F6F1' });
  const tree = owner.type(owner.props);
  const [status, navigation] = tree.props.children;
  assert.equal(status.type, 'StatusBar');
  assert.equal(status.props.style, 'light', 'dark header retains light status icons');
  assert.equal(navigation.props.style, 'dark', 'light bottom surface gets dark navigation icons');
  assert.equal(status.props.hidden, false);
  assert.equal(navigation.props.hidden, false);
  h.effects.splice(0).forEach(effect => effect());
  assert.deepEqual(h.backgrounds, ['#F4F6F1']);
});

test('startup cover retains ownership when a route mounts late, and releases it after startup', () => {
  const h = harness();
  const startup = h.StartupSystemBars();
  const release = h.effects.shift()();
  const underlying = { style: 'dark', backgroundColor: '#F4F3EF' };
  assert.equal(h.ScreenSystemBars(underlying), null, 'language route cannot recolor the dark startup cover');
  const [status, navigation] = startup.type(startup.props).props.children;
  assert.equal(status.props.style, 'light');
  assert.equal(navigation.props.style, 'light');
  release();
  assert.ok(h.ScreenSystemBars(underlying), 'focused route takes ownership after splash/retry exits');
});

test('multiple startup covers and repeated cleanup cannot prematurely release the final cover', () => {
  const store = load('src/lib/systemBarOverrides.ts').createSystemBarOverrides();
  const snapshots = [];
  const unsubscribe = store.subscribe(() => snapshots.push(store.getSnapshot()));
  const releaseA = store.acquire();
  const releaseB = store.acquire();
  releaseA();
  releaseA();
  assert.equal(store.getSnapshot(), true);
  releaseB();
  assert.equal(store.getSnapshot(), false);
  unsubscribe();
  store.acquire()();
  assert.deepEqual(snapshots, [true, true, true, false]);
});

test('web neither changes its page background nor renders an Android navigation controller', () => {
  const h = harness('web');
  const owner = h.ScreenSystemBars({ style: 'dark', backgroundColor: '#FFFFFF' });
  const tree = owner.type(owner.props);
  assert.equal(tree.props.children[1], false);
  h.effects.splice(0).forEach(effect => effect());
  assert.deepEqual(h.backgrounds, []);
  assert.equal(h.ModalSystemBars({}).props.children[1], false);
});

test('modal dims the top and selects bottom icon contrast for bottom versus centered sheets', () => {
  const h = harness();
  const [status, navigation] = h.ModalSystemBars({}).props.children;
  assert.equal(status.type, 'StatusBar');
  assert.equal(status.props.style, 'light', 'light-route dark icons must not remain under the dark modal dimmer');
  assert.equal(navigation.type, 'NavigationBar');
  assert.equal(navigation.props.style, 'dark');
  assert.equal(navigation.props.hidden, false);
  assert.equal(h.ModalSystemBars({ centered: true }).props.children[1].props.style, 'light', 'centered sheet leaves dark dimmer at bottom');
  assert.equal(h.effects.length, 0, 'modal must not change the underlying root background');
});

test('native configuration keeps visible bars, transparent three-button mode, resize and the original splash', () => {
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  const plugins = new Map(config.plugins.filter(Array.isArray));
  assert.equal(config.android.softwareKeyboardLayoutMode, 'resize');
  assert.equal(config.orientation, 'default');
  assert.equal(config.backgroundColor, '#0D1011');
  assert.deepEqual(plugins.get('expo-navigation-bar'), { style: 'light', hidden: false, enforceContrast: false });
  assert.deepEqual(plugins.get('expo-status-bar'), { style: 'light', hidden: false });
  assert.deepEqual(plugins.get('expo-splash-screen'), { backgroundColor: '#0D1011', image: './assets/android-icon-backgrounds.png', imageWidth: 96, resizeMode: 'contain' });
  assert.ok(!('edgeToEdgeEnabled' in config.android), 'SDK58 must not reintroduce the obsolete flag');
});
