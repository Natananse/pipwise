const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, process: { env: {} }, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } }, { filename: file });
  return module.exports;
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  return node && typeof node === 'object' ? [node, ...all(node.props.children)] : [];
}
function style(value) {
  if (typeof value === 'function') return style(value({ pressed: false }));
  return Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
}

// Exercises the actual route and presentation components. Closed sheets omit
// their children, so hidden disclaimers cannot pass the clean-screen checks.
// Native painting, font layout, scrolling and animation timing remain device checks.
function fixture({ params = {}, loaded = true, ready = true, favorites = ['EUR/USD', 'BTC/USD'], reducedMotion = true,
  width = 390, height = 844, insets = { top: 30, bottom: 24, left: 7, right: 9 }, storageError = '' } = {}) {
  const market = load('src/lib/market.ts');
  const marketTypes = load('src/lib/marketTypes.ts');
  const navigation = load('src/lib/navigation.ts');
  const tokens = load('src/lib/tradeTheme.ts');
  const { createDemoMarket } = load('src/lib/demoMarket.ts', { './market': market, './marketTypes': marketTypes });
  const feed = createDemoMarket({ now: () => Date.UTC(2026, 10, 5, 12), seed: 71 });
  const instances = new Map(), calls = [], animations = [];
  let current, tree, pending, visited, dirty, paused = false, haptics = 0, demoSubscriptions = 0;
  const workspace = { loaded, wallet: { cash: 10000, positions: [], history: [] }, favorites: [...favorites], storageError,
    toggle(key, value) {
      assert.equal(key, 'favorites');
      workspace.favorites = workspace.favorites.includes(value) ? workspace.favorites.filter(item => item !== value) : [...workspace.favorites, value];
    } };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const record = current, index = record.cursor++;
      if (!(index in record.slots)) record.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [record.slots[index].value, next => {
        const before = record.slots[index].value;
        record.slots[index].value = typeof next === 'function' ? next(before) : next;
        dirty ||= before !== record.slots[index].value;
      }];
    },
    useRef(initial) { return (current.slots[current.cursor++] ??= { current: initial }); },
    useMemo(callback, deps) {
      const index = current.cursor++, before = current.slots[index];
      if (!before || deps.some((dep, i) => dep !== before.deps[i])) current.slots[index] = { value: callback(), deps };
      return current.slots[index].value;
    },
    useEffect(callback, deps) {
      const record = current, index = record.cursor++, before = record.slots[index];
      if (!before || deps.some((dep, i) => dep !== before.deps[i])) pending.push(() => {
        before?.cleanup?.(); record.slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  react.default = react;
  class AnimatedValue {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate() { return 0; }
  }
  const native = {
    ...Object.fromEntries(['Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name])),
    Platform: { OS: 'android' }, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width, height }),
    Animated: {
      View: 'Animated.View', Text: 'Animated.Text', Value: AnimatedValue,
      timing(value, config) { animations.push(config); return { start() { value.setValue(config.toValue); }, stop() {} }; },
      parallel(items) { return { start() { items.forEach(item => item.start()); }, stop() { items.forEach(item => item.stop()); } }; },
    },
  };
  const theme = { fonts: { medium: 'Medium', bold: 'Bold', extraBold: 'ExtraBold', semibold: 'SemiBold' }, ThemeSurface: 'ThemeSurface' };
  const motion = { useReducedMotion: () => reducedMotion };
  const presentations = load('src/components/TradePresentation.tsx', {
    react, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    '../lib/theme': theme, '../lib/tradeTheme': tokens, '../lib/useReducedMotion': motion,
    './ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
  });
  const design = {
    ...presentations,
    ...Object.fromEntries(['AppInput', 'ErrorState', 'Icon', 'Label', 'Row'].map(name => [name, name])),
    AppButton: ({ label, onPress, ...props }) => react.createElement('Pressable', { ...props, onPress, accessibilityRole: 'button', accessibilityLabel: label }, label),
    Sheet: ({ visible, children, ...props }) => visible ? react.createElement('Sheet', { ...props, visible }, children) : null,
  };
  const router = {
    push(route) { calls.push({ action: 'push', route }); },
    setParams(next) { params = { ...params, ...next }; },
  };
  const { default: Trade } = load('src/app/(tabs)/practice.tsx', {
    react, 'react-native': native, 'expo-router': { router, useLocalSearchParams: () => params },
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '../../components/MarketBadge': { MarketBadge: 'MarketBadge' },
    '../../components/LiveMarkets': { LiveMarkets: 'LiveMarkets' },
    '../../components/OrderBottomSheet': { OrderBottomSheet: 'OrderBottomSheet' },
    '../../components/TradingChart': { TradingChart: 'TradingChart' },
    '../../components/design': design, '../../lib/haptics': { lightHaptic() { haptics++; } },
    '../../lib/market': market, '../../lib/marketTypes': marketTypes,
    '../../lib/marketVisuals': { marketVisual: asset => ({ label: asset.name }) },
    '../../lib/navigation': navigation, '../../lib/simulator': { summary: () => ({ equity: workspace.wallet.cash }) },
    '../../lib/theme': theme, '../../lib/useReducedMotion': motion, '../../lib/workspace': { useWorkspace: () => workspace },
    '../../lib/demoMarketProvider': { useDemoMarket: () => {
      demoSubscriptions++;
      const snapshot = feed.getSnapshot();
      return { market: feed, quotes: Object.fromEntries(Object.entries(snapshot.quotes).map(([symbol, quote]) => [symbol, quote.price])),
        paused, setPaused(next) { paused = next; }, ready, storageError: '' };
    } },
  });
  function expand(node, location) {
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${location}.${index}`));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const id = `${location}:${node.type.name}:${node.props.key ?? ''}`;
      if (!instances.has(id)) instances.set(id, { slots: [], cursor: 0 });
      const record = instances.get(id), parent = current;
      current = record; current.cursor = 0; visited.add(id);
      const result = node.type(node.props); current = parent;
      return expand(result, `${id}.view`);
    }
    return { ...node, props: { ...node.props, children: expand(node.props.children, `${location}.children`) } };
  }
  function render() {
    for (let attempt = 0; attempt < 15; attempt++) {
      dirty = false; visited = new Set(); pending = [];
      tree = expand(react.createElement(Trade, {}), 'root');
      for (const [id, record] of instances) if (!visited.has(id)) { record.slots.forEach(slot => slot?.cleanup?.()); instances.delete(id); }
      pending.forEach(effect => effect());
      if (!dirty) return;
    }
    throw new Error('Unexpected render loop');
  }
  render();
  return {
    calls, animations, workspace, tokens, navigation, feed, render,
    get haptics() { return haptics; }, get demoSubscriptions() { return demoSubscriptions; },
    all: () => all(tree), text: () => text(tree), nodes: type => all(tree).filter(node => node.type === type),
    node: type => all(tree).find(node => node.type === type),
    press(label) {
      const action = all(tree).find(node => node.props.accessibilityLabel === label);
      assert.ok(action, `Missing visible action ${label}`); action.props.onPress(); render();
    },
    input(label, value) { const field = all(tree).find(node => node.type === 'AppInput' && node.props.label === label); assert.ok(field); field.props.onChangeText(value); render(); },
    tick() { if (!paused) feed.tick(feed.getSnapshot().asOf + 1000); render(); },
    updateReady(next) { ready = next; render(); },
  };
}

test('default Trade renders the actual bright surface with one practice label and one Buy/Sell bar', () => {
  const h = fixture();
  assert.equal(h.node('ThemeSurface').props.tone, 'light');
  const rootStyle = style(h.node('View').props.style);
  assert.equal(rootStyle.backgroundColor, '#F7F5EF');
  assert.equal(rootStyle.paddingLeft, 7);
  assert.equal(rootStyle.paddingRight, 9);
  assert.equal(h.node('ScreenSystemBars').props.style, 'dark');
  assert.equal(h.node('TradingChart').props.presentation, 'trade');
  assert.equal(h.nodes('Label').filter(node => text(node).trim() === 'Practice money · Simulated prices').length, 1);
  assert.deepEqual(h.nodes('Pressable').filter(node => node.props.accessibilityRole === 'button').map(node => node.props.accessibilityLabel).sort(), ['About this practice', 'Buy', 'Sell']);
  assert.equal(h.nodes('Sheet').length, 0);
  assert.doesNotMatch(h.text(), /THE TRADING ROOM|Explore Pro|Moving simulated prices|No live market feed|Build your edge|One market\./);
  assert.equal(h.nodes('Pressable').filter(node => node.props.accessibilityRole === 'tab').length, 7);
  assert.equal(h.nodes('Svg').length, 7, 'Every market pill uses its actual recent-candle sparkline');
  assert.equal(h.nodes('ScrollView').find(node => node.props.horizontal).props.snapToInterval, 160);
});

test('details keep truthful simulation, fee and manual-target explanations reachable off the main page', () => {
  const h = fixture();
  h.press('About this practice');
  assert.equal(h.node('Sheet').props.title, 'Practice details');
  assert.match(h.text(), /Moving simulated prices/);
  assert.match(h.text(), /No live market feed/);
  assert.match(h.text(), /Entry and closing each incur a 0\.02% simulated fee/);
  assert.match(h.text(), /saved practice targets, not automatic exits/);
  assert.match(h.text(), /UTC opening times/);
  h.press('Pause simulated market');
  const before = h.node('TradingChart').props.asset.price;
  h.tick(); assert.equal(h.node('TradingChart').props.asset.price, before);
  h.press('Resume simulated market'); h.tick();
  assert.notEqual(h.node('TradingChart').props.asset.price, before);
  h.press('Full trading disclaimer');
  assert.equal(h.calls.at(-1).route, '/disclaimer');
  assert.equal(h.nodes('Sheet').length, 0);
  assert.doesNotMatch(h.text(), /No live market feed/);
});

test('selector search, favorites and selection update the same chart and order source', () => {
  const h = fixture();
  h.press('About this practice'); h.press('Markets and watchlist');
  assert.equal(h.node('Sheet').props.title, 'Markets and watchlist');
  h.input('Find a market', 'gold');
  assert.ok(h.all().some(node => node.props.accessibilityLabel === 'Select XAU/USD'));
  assert.ok(!h.all().some(node => node.props.accessibilityLabel === 'Select EUR/USD'));
  h.press('Add XAU/USD to watchlist');
  assert.ok(h.workspace.favorites.includes('XAU/USD'));
  h.input('Find a market', ''); h.press('Watchlist (3)');
  assert.equal(h.nodes('Pressable').filter(node => node.props.accessibilityRole === 'tab').length, 3);
  h.press('Remove XAU/USD from watchlist');
  assert.equal(h.nodes('Pressable').filter(node => node.props.accessibilityRole === 'tab').length, 2);
  h.press('Select BTC/USD');
  assert.equal(h.nodes('Sheet').length, 0);
  const chart = h.node('TradingChart');
  assert.equal(chart.props.asset.symbol, 'BTC/USD');
  assert.equal(chart.props.asset.price, chart.props.external.candles.at(-1).close);
  assert.equal(chart.props.asset.price, h.node('OrderBottomSheet').props.asset.price);
  assert.equal(chart.props.keyLevels.length, 5);
  h.press('Buy'); assert.equal(h.node('OrderBottomSheet').props.direction, 'buy');
  h.press('Sell'); assert.equal(h.node('OrderBottomSheet').props.direction, 'sell');
  h.tick();
  assert.equal(h.node('TradingChart').props.asset.price, h.node('OrderBottomSheet').props.asset.price);
});

test('empty watchlists recover without replacing the selected market or inventing quotes', () => {
  const h = fixture({ favorites: [] });
  h.press('About this practice'); h.press('Markets and watchlist'); h.press('Watchlist (0)');
  assert.match(h.text(), /Your watchlist is empty/);
  assert.equal(h.node('TradingChart').props.asset.symbol, 'EUR/USD');
  assert.equal(h.nodes('Pressable').filter(node => node.props.accessibilityRole === 'tab').length, 0);
  h.press('Browse all markets');
  assert.equal(h.nodes('Pressable').filter(node => node.props.accessibilityRole === 'tab').length, 7);
  assert.equal(h.node('TradingChart').props.asset.price, h.feed.getQuote('EUR/USD').price);
});

test('selection from a filtered watchlist scrolls to its visible pill', () => {
  const h = fixture({ favorites: ['EUR/USD', 'XAU/USD'] });
  h.press('About this practice'); h.press('Markets and watchlist'); h.press('Watchlist (2)');
  const scrolls = [];
  h.nodes('ScrollView').find(node => node.props.horizontal).props.ref.current = { scrollTo: value => scrolls.push(value) };
  h.press('Select XAU/USD');
  assert.equal(h.node('TradingChart').props.asset.symbol, 'XAU/USD');
  assert.ok(scrolls.at(-1).x < 160, 'The selected pill is second in this watchlist, rather than sixth in all markets');
});

test('safe inset and floating-dock clearance remain reserved for content and the order bar', () => {
  const h = fixture();
  const header = h.nodes('View').find(node => style(node.props.style).paddingTop === 38);
  assert.ok(header, 'Header retains the top safe inset plus spacing');
  const footer = h.nodes('View').find(node => style(node.props.style).position === 'absolute' && style(node.props.style).bottom === 0);
  assert.ok(footer);
  const footerStyle = style(footer.props.style);
  assert.equal(footerStyle.left, 7); assert.equal(footerStyle.right, 9);
  assert.ok(footerStyle.paddingBottom >= h.navigation.tabBarClearance(24));
  const content = h.nodes('ScrollView').find(node => !node.props.horizontal);
  assert.ok(content.props.contentContainerStyle.paddingBottom >= footerStyle.paddingBottom + 56);
});

test('readiness uses the actual skeleton and disables order entry until data is ready', () => {
  const h = fixture({ ready: false });
  assert.ok(h.all().some(node => node.props.accessibilityLabel === 'Preparing your practice workspace' && node.props.accessibilityState?.busy));
  assert.equal(h.node('TradingChart'), undefined);
  assert.ok(!h.all().some(node => ['Buy', 'Sell'].includes(node.props.accessibilityLabel)));
  h.updateReady(true);
  assert.ok(h.node('TradingChart'));
  assert.ok(h.all().some(node => node.props.accessibilityLabel === 'Buy'));
});

test('price changes respect reduced motion and only user actions trigger haptics', () => {
  const reduced = fixture(); reduced.tick();
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.haptics, 0);
  const moving = fixture({ reducedMotion: false }); moving.tick();
  assert.ok(moving.animations.length > 0);
  assert.ok(moving.animations.every(animation => animation.duration <= 300 && animation.isInteraction === false));
  assert.equal(moving.haptics, 0);
  moving.press('Buy'); assert.equal(moving.haptics, 1);
});

test('explicit provider mode keeps its existing presentation and does not subscribe to demo prices', () => {
  const h = fixture({ params: { mode: 'markets', symbol: 'BTC/USD' } });
  assert.equal(h.node('ThemeSurface').props.tone, 'dark');
  assert.equal(h.node('LiveMarkets').props.initialSymbol, 'BTC/USD');
  assert.equal(h.node('TradingChart'), undefined);
  assert.equal(h.demoSubscriptions, 0);
  assert.equal(h.node('ScreenSystemBars'), undefined);
});
