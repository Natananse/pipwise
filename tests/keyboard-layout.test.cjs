const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: initial => ({ current: initial }),
};
const colors = { bg: '#0D1011', darkBg: '#0D1011', overlay: 'overlay', sheet: 'sheet', sheetBorder: 'sheetBorder' };
const insets = { top: 32, left: 8, right: 12, bottom: 24 };

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}

function native(platform, width = 390) {
  return {
    Platform: { OS: platform },
    StyleSheet: { absoluteFill: { position: 'absolute' } },
    useWindowDimensions: () => ({ width, height: 844 }),
    ...Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name])),
  };
}

function nodes(tree) {
  const result = [];
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    result.push(value);
    if (typeof value.type === 'function' && value.type.name === 'SheetContent') visit(value.type(value.props));
    else visit(value.props?.children);
  };
  visit(tree);
  return result;
}

function design(platform, width = 390, segments = ['disclaimer']) {
  return load('src/components/design.tsx', {
    react,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { router: {}, useSegments: () => segments },
    'react-native': native(platform, width),
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => insets },
    '../lib/theme': { fonts: {}, ThemeSurface: 'ThemeSurface', useTheme: () => ({ colors }) },
    '../lib/navigation': load('src/lib/navigation.ts'),
    '../lib/workspace': { useWorkspace: () => ({ storageError: '' }) },
    './AppLogo': { AppLogo: 'AppLogo' },
    './ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars', ModalSystemBars: 'ModalSystemBars' },
    './TradePresentation': {
      TradeSurface: 'TradeSurface', TradeTopBar: 'TradeTopBar', TradeAssetTile: 'TradeAssetTile',
      TradeSparkline: 'TradeSparkline', TradeHeroQuote: 'TradeHeroQuote', TradeChartCard: 'TradeChartCard',
      TradeFooter: 'TradeFooter', TradeActionButton: 'TradeActionButton', TradeSkeleton: 'TradeSkeleton',
    },
  });
}

test('sheet keyboard scrolling stays inside modal cutout bounds and owns its bars only while visible', () => {
  for (const platform of ['android', 'ios', 'web']) {
    const api = design(platform);
    const tree = api.Sheet({ visible: true, onClose() {}, title: 'Confirm', children: 'FORM_PLACEHOLDER' });
    const rendered = nodes(tree);
    assert.equal(tree.type, 'Modal');
    assert.equal(tree.props.statusBarTranslucent, true);
    assert.equal(tree.props.navigationBarTranslucent, true);
    assert.equal(rendered.filter(node => node.type === 'SafeAreaProvider').length, platform === 'web' ? 0 : 1);
    assert.equal(rendered.filter(node => node.type === 'ModalSystemBars').length, 1);
    assert.equal(rendered.some(node => node.type === 'ScreenSystemBars'), false, 'Sheet must release the modal bar entry on close');
    const avoidance = rendered.filter(node => node.type === 'KeyboardAvoidingView');
    assert.equal(avoidance.length, 1);
    assert.equal(avoidance[0].props.behavior, platform === 'web' ? undefined : 'padding');
    const overlay = rendered.find(node => node.type === 'View' && node.props.style.backgroundColor === colors.overlay);
    assert.deepEqual({ top: overlay.props.style.paddingTop, left: overlay.props.style.paddingLeft, right: overlay.props.style.paddingRight },
      { top: insets.top, left: insets.left, right: insets.right });
    const panel = rendered.find(node => node.type === 'SafeAreaView');
    assert.deepEqual(Array.from(panel.props.edges), ['bottom']);
    assert.equal(panel.props.style.maxHeight, '92%');
    const scroll = rendered.find(node => node.type === 'ScrollView');
    assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, false);
    assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
    assert.equal(scroll.props.keyboardDismissMode, platform === 'ios' ? 'interactive' : 'on-drag');
    assert.equal(nodes(api.Sheet({ visible: false, onClose() {}, title: 'Confirm' })).some(node => node.type === 'ModalSystemBars'), false);
  }
});

test('shared pages reserve the real bottom obstruction and keep status icons tied to their existing surface', () => {
  for (const [width, segments, expected] of [[390, ['disclaimer'], 46], [390, ['(tabs)', 'news'], 128], [1200, ['(tabs)', 'news'], 56]]) {
    const rendered = nodes(design('android', width, segments).Page({ title: 'Page', subtitle: 'Context', children: 'CONTENT_PLACEHOLDER' }));
    const scroll = rendered.find(node => node.type === 'ScrollView');
    assert.equal(scroll.props.contentContainerStyle.paddingBottom, expected);
    const bars = rendered.find(node => node.type === 'ScreenSystemBars');
    assert.equal(bars.props.style, 'light');
    assert.equal(bars.props.backgroundColor, colors.bg);
  }
});

test('auth-flow forms use one native avoidance mechanism without automatic extra keyboard insets', () => {
  for (const platform of ['android', 'ios', 'web']) {
    const { AuthFlowScreen } = load('src/components/AuthFlowScreen.tsx', {
      react,
      'react-native': native(platform),
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '../lib/theme': { fonts: {}, ThemeSurface: 'ThemeSurface' },
      './AppLogo': { AppLogo: 'AppLogo' },
      './design': { Icon: 'Icon', Label: 'Label' },
      './ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
    });
    const rendered = nodes(AuthFlowScreen({ title: 'Account access', detail: 'Continue', icon: 'key-outline', children: 'FORM_PLACEHOLDER' }));
    const avoidance = rendered.filter(node => node.type === 'KeyboardAvoidingView');
    assert.equal(avoidance.length, 1);
    assert.equal(avoidance[0].props.behavior, platform === 'web' ? undefined : 'padding');
    const scroll = rendered.find(node => node.type === 'ScrollView');
    assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, false);
    assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
    const bars = rendered.find(node => node.type === 'ScreenSystemBars');
    assert.equal(bars.props.style, 'dark');
    assert.equal(bars.props.backgroundColor, '#F4F3EF');
  }
});

test('floating dock hides for the native keyboard, returns with safe clearance and cleans up listeners', () => {
  const slots = [];
  const effects = [];
  const listeners = new Map();
  const removed = [];
  let cursor = 0;
  const hooks = {
    createElement: react.createElement,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect(effect) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(effect); } },
  };
  const { FloatingTabBar } = load('src/components/FloatingTabBar.tsx', {
    react: hooks,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native': {
      ...native('android'),
      Animated: { Value: class { setValue() {} }, View: 'AnimatedView' },
      StyleSheet: { create: value => value },
      Keyboard: { isVisible: () => false, addListener(event, callback) { listeners.set(event, callback); return { remove() { removed.push(event); listeners.delete(event); } }; } },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '../lib/navigation': load('src/lib/navigation.ts'),
    '../lib/theme': { fonts: {} },
    '../lib/useReducedMotion': { useReducedMotion: () => true },
    './reference': { referenceColors: {} },
  });
  const props = { state: { index: 0, routes: [{ name: 'practice', key: 'practice' }] }, descriptors: { practice: { options: { title: 'Trade' } } } };
  const render = () => { cursor = 0; return FloatingTabBar(props); };
  const initial = render();
  assert.equal(initial.props.style[1].bottom, insets.bottom + 12);
  const cleanup = effects.splice(0).map(effect => effect()).filter(Boolean);
  listeners.get('keyboardDidShow')();
  assert.equal(render(), null);
  listeners.get('keyboardDidHide')();
  assert.equal(render().props.style[1].bottom, insets.bottom + 12);
  cleanup.forEach(effect => effect());
  assert.deepEqual(removed.sort(), ['keyboardDidHide', 'keyboardDidShow']);
});
