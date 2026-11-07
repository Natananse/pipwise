const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

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

const navigation = load('src/lib/navigation.ts');

test('bottom spacing reserves the floating dock only on narrow tab screens', () => {
  for (const bottomInset of [0, 24, 48]) {
    const narrowTab = { bottomInset, wide: false, tabRoute: true };
    assert.equal(navigation.contentBottomPadding(narrowTab), bottomInset + 70 + 12 + 20);
    assert.equal(navigation.floatingFooterBottom(narrowTab), bottomInset + 70 + 12 + 10);
    for (const context of [
      { bottomInset, wide: false, tabRoute: false },
      { bottomInset, wide: true, tabRoute: true },
      { bottomInset, wide: true, tabRoute: false },
    ]) {
      assert.equal(navigation.contentBottomPadding(context), bottomInset + 20);
      assert.equal(navigation.floatingFooterBottom(context), bottomInset + 10);
    }
  }
});

test('measured floating actions leave the final content above the entire footer and system inset', () => {
  for (const tabRoute of [false, true]) for (const wide of [false, true]) {
    const context = { bottomInset: 34, tabRoute, wide };
    const footerHeight = 146;
    const bottom = navigation.floatingFooterBottom({ ...context, gap: 12 });
    const padding = navigation.contentBottomPadding({ ...context, contentGap: 22, footerHeight, footerGap: 12 });
    assert.equal(padding - bottom - footerHeight, 22);
    assert(bottom >= context.bottomInset);
  }
  assert.equal(navigation.contentBottomPadding({ bottomInset: 34, wide: false, tabRoute: false, footerHeight: 0, footerGap: 999 }), 54);
});

test('profile changes top icon contrast only after the full-width dark hero leaves the viewport', () => {
  const topInset = 34;
  const surfaceTop = 268 + topInset;
  const overlappingCardTop = surfaceTop - 31;
  for (const scrollOffset of [0, overlappingCardTop - topInset, overlappingCardTop, surfaceTop - 1]) {
    assert.equal(navigation.scrolledSurfaceAtTop({ scrollOffset, surfaceTop }), false,
      'the overlapping rounded card does not cover the full-width dark hero');
  }
  assert.equal(navigation.scrolledSurfaceAtTop({ scrollOffset: surfaceTop, surfaceTop }), true);
  assert.equal(navigation.scrolledSurfaceAtTop({ scrollOffset: surfaceTop + 1, surfaceTop }), true);
});

function referenceHarness({ width = 390, segments = ['(tabs)', 'analyse'], footer } = {}) {
  const insets = { top: 24, right: 18, bottom: 34, left: 12 };
  const slots = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useId: () => 'reference-test',
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ||= { value: initial };
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
  };
  react.default = react;
  const reference = load('src/components/reference.tsx', {
    react,
    '@expo/vector-icons': {},
    'expo-router': { router: {}, useSegments: () => segments },
    'react-native': {
      Platform: { OS: 'android' }, StyleSheet: { absoluteFill: {} },
      Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
      useWindowDimensions: () => ({ width, height: 844 }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    'react-native-svg': { __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Rect: 'Rect', Stop: 'Stop' },
    '../lib/market': { money: () => '$10,000' },
    '../lib/simulator': { summary: () => ({ equity: 10000 }) },
    '../lib/demoMarketProvider': { useDemoMarket: () => ({ quotes: {} }) },
    '../lib/navigation': navigation,
    '../lib/responsiveLayout': load('src/lib/responsiveLayout.ts'),
    '../lib/theme': { ThemeSurface: ({ children }) => children },
    '../lib/workspace': { useWorkspace: () => ({ loaded: true, storageError: '', wallet: {} }) },
    './design': { ErrorState: 'ErrorState', Icon: 'Icon', Label: 'Label', LoadingState: 'LoadingState', Row: 'Row' },
    './ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
  });
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.type === 'function') return expand(value.type(value.props));
    return { ...value, props: { ...value.props, children: expand(value.props.children) } };
  }
  function find(value, predicate) {
    if (Array.isArray(value)) {
      for (const child of value) { const result = find(child, predicate); if (result) return result; }
      return null;
    }
    if (!value || typeof value !== 'object') return null;
    return predicate(value) ? value : find(value.props?.children, predicate);
  }
  return {
    render() { cursor = 0; return expand(reference.ReferenceScreen({ children: 'content', footer })); },
    find, insets,
  };
}

test('ReferenceScreen distinguishes standalone routes from tabs and retains side cutout padding', () => {
  for (const [segments, width, expected] of [
    [['(tabs)', 'learn'], 390, 136],
    [['settings'], 390, 54],
    [['feedback'], 390, 54],
    [['(tabs)', 'learn'], 1200, 66],
  ]) {
    const h = referenceHarness({ segments, width });
    const tree = h.render();
    const scroll = h.find(tree, element => element.type === 'ScrollView');
    assert.equal(scroll.props.contentContainerStyle.paddingBottom, expected);
    assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, false, 'the outer keyboard owner must not be duplicated');
    const frame = h.find(tree, element => element.type === 'View' && element.props.style?.paddingLeft === h.insets.left);
    assert.equal(frame.props.style.paddingRight, h.insets.right);
    const bars = h.find(tree, element => element.type === 'ScreenSystemBars');
    assert.equal(bars.props.style, 'light', 'the existing ReferenceHeader remains dark');
    assert.equal(bars.props.navigationStyle, 'dark', 'the bottom surface remains light');
  }
});

test('ReferenceScreen recalculates clearance from actual footer height for large text', () => {
  const h = referenceHarness({ footer: 'action' });
  const first = h.render();
  const footer = h.find(first, element => element.type === 'View' && typeof element.props.onLayout === 'function');
  assert.equal(footer.props.style.bottom, 126);
  footer.props.onLayout({ nativeEvent: { layout: { height: 146 } } });
  const updated = h.render();
  const scroll = h.find(updated, element => element.type === 'ScrollView');
  assert.equal(scroll.props.contentContainerStyle.paddingBottom, 292);
  assert.equal(scroll.props.contentContainerStyle.paddingBottom - footer.props.style.bottom - 146, 20);
});
