const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, ...globals, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const responsive = load('src/lib/responsiveLayout.ts');
const navigation = load('src/lib/navigation.ts');

function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() }; });
      }
    },
  };
  react.default = react;
  return { react, begin() { cursor = 0; effects = []; }, flush() { effects.splice(0).forEach(effect => effect()); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props?.children)];
}

function sheetHarness(width, height) {
  const h = hooks();
  const frames = new Map();
  let frameId = 0;
  let focused = null;
  const insets = { top: 0, left: 0, right: 0, bottom: 0 };
  const api = load('src/components/design.tsx', {
    react: h.react,
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: {}, useSegments: () => ['settings'] },
    'react-native': {
      Platform: { OS: 'android' }, StyleSheet: { absoluteFill: {} }, useWindowDimensions: () => ({ width, height }),
      ...Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name])),
      TextInput: { State: { currentlyFocusedInput: () => focused } },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', SafeAreaProvider: 'SafeAreaProvider', useSafeAreaInsets: () => insets },
    '../lib/theme': { fonts: {}, ThemeSurface: 'ThemeSurface', useTheme: () => ({ colors: { overlay: 'overlay', sheet: 'sheet' } }) },
    '../lib/navigation': navigation,
    '../lib/responsiveLayout': responsive,
    '../lib/workspace': { useWorkspace: () => ({}) },
    './AppLogo': { AppLogo: 'AppLogo' },
    './ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars', ModalSystemBars: 'ModalSystemBars' },
    './TradePresentation': {},
  }, {
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  return {
    render() { h.begin(); const tree = api.Sheet({ visible: true, title: 'Account details', onClose() {}, children: 'PRESERVED_FORM_STATE' }); const result = nodes(tree); h.flush(); return result; },
    focus(input) { focused = input; },
    flushFrames() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    unmount: h.unmount,
  };
}

test('sheets rotate with bounded scrolling, compact chrome, and one keyboard avoidance layer', () => {
  for (const [width, height, expectedMax] of [[390, 844, '92%'], [844, 390, '100%']]) {
    const rendered = sheetHarness(width, height).render();
    const modal = rendered.find(node => node.type === 'Modal');
    assert.ok(modal.props.supportedOrientations.includes('landscape-left'));
    assert.ok(modal.props.supportedOrientations.includes('landscape-right'));
    assert.equal(rendered.filter(node => node.type === 'KeyboardAvoidingView').length, 1);
    assert.equal(rendered.find(node => node.type === 'SafeAreaView').props.style.maxHeight, expectedMax);
    const scroll = rendered.find(node => node.type === 'ScrollView');
    assert.equal(scroll.props.style.minHeight, 0);
    assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, false);
    assert.ok(scroll.props.children.flat(Infinity).includes('PRESERVED_FORM_STATE'));
  }
});

test('keyboard-reduced sheet frames compact without replacing the form and reveal the measured focused field', () => {
  const h = sheetHarness(390, 844);
  let rendered = h.render();
  const overlay = rendered.find(node => node.type === 'View' && node.props.style.backgroundColor === 'overlay');
  overlay.props.onLayout({ nativeEvent: { layout: { height: 250 } } });
  rendered = h.render();
  assert.equal(rendered.find(node => node.type === 'SafeAreaView').props.style.maxHeight, '100%');
  const scroll = rendered.find(node => node.type === 'ScrollView');
  const moves = [];
  scroll.props.ref.current = { measureInWindow: callback => callback(0, 56, 360, 160), scrollTo: value => moves.push(value) };
  h.focus({ measureInWindow: callback => callback(0, 200, 300, 52) });
  scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 80 } } });
  scroll.props.onFocus();
  h.flushFrames();
  assert.equal(moves.at(-1).y, 124, 'input bottom clears the actual resized viewport');
  assert.equal(moves.at(-1).animated, false);
  scroll.props.onFocus();
  scroll.props.onBlur();
  h.flushFrames();
  assert.equal(moves.length, 1, 'an input that lost focus must not move the sheet');
  scroll.props.onFocus();
  h.unmount();
  h.flushFrames();
  assert.equal(moves.length, 1, 'unmounted modal cancels scheduled measurements');
});

test('Profile keeps the selected statistics page when its measured width changes', () => {
  const h = hooks();
  let width = 390;
  let height = 844;
  const { default: Profile } = load('src/app/(tabs)/profile.tsx', {
    react: h.react,
    'expo-router': { router: {} },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width, height }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Rect: 'Rect', Stop: 'Stop' },
    '../../components/AvatarPortrait': { AvatarPortrait: 'AvatarPortrait' },
    '../../components/RegistrationFields': { RegistrationFields: 'RegistrationFields' },
    '../../components/ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
    '../../components/design': Object.fromEntries(['AppButton', 'AppInput', 'Icon', 'Label', 'Sheet'].map(name => [name, name])),
    '../../components/reference': { referenceColors: { charcoal: '#111111', mint: '#00ffaa' } },
    '../../lib/lessons': { lessons: [] },
    '../../lib/accountProfile': {}, '../../lib/accountDetails': {}, '../../lib/registrationDetails': {},
    '../../lib/demoMarketProvider': { useDemoMarket: () => ({ quotes: {}, ready: true }) },
    '../../lib/languages': { languageInfo: () => ({ nativeName: 'English' }) },
    '../../lib/navigation': navigation,
    '../../lib/responsiveLayout': responsive,
    '../../lib/market': { money: value => `$${value}` },
    '../../lib/neonAuth': {},
    '../../lib/profileIdentity': { resolveProfileIdentity: () => ({ displayName: 'Practice', editableName: 'Practice', avatarId: 'owl', email: '' }) },
    '../../lib/session': { useSession: () => ({ session: null, demo: true, plan: 'free' }) },
    '../../lib/startupTasks': {},
    '../../lib/simulator': { initialWallet: { cash: 10000 }, summary: () => ({ equity: 10000 }) },
    '../../lib/theme': { fonts: {}, ThemeSurface: 'ThemeSurface' },
    '../../lib/workspace': { useWorkspace: () => ({ wallet: { cash: 10000, positions: [], history: [] }, completed: [], profile: {}, preferences: { markets: [], goal: '', experience: '' }, language: 'en' }) },
  });
  const render = () => { h.begin(); const result = nodes(Profile()); return result; };
  let rendered = render();
  const carousel = rendered.find(node => node.type === 'ScrollView' && node.props.pagingEnabled);
  const moves = [];
  carousel.props.ref.current = { scrollTo: value => moves.push(value) };
  h.flush();
  carousel.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 358 }, layoutMeasurement: { width: 358 } } });
  rendered = render(); h.flush();
  width = 844; height = 390;
  rendered = render(); h.flush();
  const card = rendered.find(node => node.type === 'View' && node.props.onLayout && node.props.style?.overflow === 'hidden');
  card.props.onLayout({ nativeEvent: { layout: { width: 812 } } });
  rendered = render(); h.flush();
  assert.equal(moves.at(-1).x, 812, 'selected page 2 is realigned to the new width');
  assert.equal(moves.at(-1).animated, false);
  const selectedDot = rendered.find(node => node.props?.accessibilityLabel === 'Profile statistics page 2');
  assert.equal(selectedDot.props.accessibilityState.selected, true);
});
