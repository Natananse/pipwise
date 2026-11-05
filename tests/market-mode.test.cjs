const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, process: { env: {} },
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}
const realMarket = load('src/lib/market.ts');
const providerCharts = load('src/lib/providerCharts.ts');
const navigation = load('src/lib/navigation.ts');
const marketTypes = load('src/lib/marketTypes.ts');
const { createDemoMarket } = load('src/lib/demoMarket.ts', { './market': realMarket, './marketTypes': marketTypes });

/** Small React hook renderer executes the actual route and its screen components. */
function fixture(initialParams = {}, { appState = 'active', focused = true, providerError = false, standalone = false, serverRendering = false } = {}) {
  let params = { ...initialParams };
  let isFocused = focused;
  let current;
  let tree;
  let visited;
  let pending;
  const instances = new Map();
  const appListeners = new Set();
  const calls = [];
  const providerMounts = [];
  const providerUnmounts = [];
  const feed = createDemoMarket({ now: () => Date.UTC(2026, 10, 5, 12), seed: 71 });
  let paused = false;
  const workspace = { loaded: true, wallet: { cash: 10000, positions: [], history: [] }, favorites: ['EUR/USD', 'BTC/USD'], storageError: '', toggle: () => {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = current.cursor++;
      const record = current;
      if (!(index in record.slots)) record.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [record.slots[index].value, next => { record.slots[index].value = typeof next === 'function' ? next(record.slots[index].value) : next; }];
    },
    useRef(initial) { const index = current.cursor++; return current.slots[index] ??= { current: initial }; },
    useSyncExternalStore(_subscribe, getSnapshot, getServerSnapshot) { current.cursor++; return serverRendering ? getServerSnapshot() : getSnapshot(); },
    useEffect(effect, deps) {
      const index = current.cursor++;
      const record = current;
      const old = record.slots[index];
      if (!old || !deps || deps.some((value, i) => value !== old.deps?.[i])) {
        pending.push(() => { old?.cleanup?.(); record.slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  react.default = react;
  const router = {
    setParams(next) { calls.push({ action: 'setParams', params: next }); params = { ...params, ...next }; },
    push(next) { calls.push({ action: 'push', route: next }); },
    replace(next) { calls.push({ action: 'replace', route: next }); },
    canGoBack: () => false,
  };
  const nativeState = { currentState: appState, addEventListener(_type, listener) { appListeners.add(listener); return { remove: () => appListeners.delete(listener) }; } };
  const native = {
    ...Object.fromEntries(['Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name])),
    StyleSheet: { create: value => value }, Platform: { OS: 'android' },
    useWindowDimensions: () => ({ width: 390, height: 844 }), AppState: nativeState,
    Animated: { View: 'AnimatedView', Value: function () { this.setValue = () => {}; this.interpolate = () => 0; }, timing: () => ({ start() {}, stop() {} }) },
  };
  const assets = realMarket.assets.map(asset => {
    const copy = { ...asset };
    Object.defineProperty(copy, 'price', { enumerable: true, get() {
      assert.notEqual(params.mode, 'markets', 'Provider mode must never read a fixed sample quote');
      return asset.price;
    } });
    return copy;
  });
  const market = { ...realMarket, assets };
  const design = Object.fromEntries(['AppInput', 'ErrorState', 'Icon', 'Label', 'LoadingState', 'Row', 'Sheet'].map(name => [name, name]));
  const shared = {
    react, 'react-native': native,
    'expo-router': { router, useLocalSearchParams: () => params, useIsFocused: () => isFocused },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  };
  function ProviderChart(props) {
    react.useEffect(() => { providerMounts.push(props.symbol); return () => providerUnmounts.push(props.symbol); }, [props.symbol]);
    return react.createElement('ProviderChart', props, providerError ? 'Provider chart could not be loaded' : 'Hosted provider chart');
  }
  const { LiveMarkets } = load('src/components/LiveMarkets.tsx', {
    ...shared, '../lib/market': market, '../lib/navigation': navigation, '../lib/providerCharts': providerCharts,
    '../lib/workspace': { useWorkspace: () => workspace }, './MarketBadge': { MarketBadge: 'MarketBadge' },
    './ProviderChart': { ProviderChart }, './design': design,
  });
  const { default: Trade } = load('src/app/(tabs)/practice.tsx', {
    ...shared, '../../components/MarketBadge': { MarketBadge: 'MarketBadge' }, '../../components/LiveMarkets': { LiveMarkets },
    '../../components/OrderBottomSheet': { OrderBottomSheet: 'OrderBottomSheet' }, '../../components/TradingChart': { TradingChart: 'TradingChart' },
    '../../components/design': design, '../../lib/haptics': { lightHaptic() {} }, '../../lib/market': market,
    '../../lib/marketVisuals': { marketVisual: asset => ({ label: asset.name, color: '#6EE7BE', tint: '#17271E', ink: '#101010', mark: asset.mark }) },
    '../../lib/navigation': navigation, '../../lib/simulator': { summary: () => ({ equity: 10000 }) },
    '../../lib/theme': { fonts: {}, ThemeSurface: 'ThemeSurface' }, '../../lib/useReducedMotion': { useReducedMotion: () => true },
    '../../lib/workspace': { useWorkspace: () => workspace },
    '../../lib/marketTypes': marketTypes,
    '../../lib/demoMarketProvider': { useDemoMarket: () => ({ market: feed, snapshot: feed.getSnapshot(), quotes: Object.fromEntries(Object.entries(feed.getSnapshot().quotes).map(([symbol, quote]) => [symbol, quote.price])), paused, setPaused: next => { paused = next; }, ready: true, storageError: '' }) },
  });
  function expand(node, location) {
    if (Array.isArray(node)) return node.map((item, i) => expand(item, `${location}.${i}`));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const id = `${location}:${node.type.name}:${node.props.key ?? ''}`;
      let record = instances.get(id);
      if (!record) { record = { slots: [], cursor: 0 }; instances.set(id, record); }
      record.cursor = 0;
      visited.add(id);
      const parent = current;
      current = record;
      const result = node.type(node.props);
      current = parent;
      return expand(result, `${id}.view`);
    }
    return { ...node, props: { ...node.props, children: expand(node.props.children, `${location}.children`) } };
  }
  function render() {
    visited = new Set();
    pending = [];
    tree = expand(react.createElement(standalone ? LiveMarkets : Trade, {}), 'root');
    for (const [id, record] of instances) if (!visited.has(id)) {
      record.slots.forEach(slot => slot?.cleanup?.()); instances.delete(id);
    }
    if (!serverRendering) pending.forEach(effect => effect());
    return tree;
  }
  function all(node) {
    if (Array.isArray(node)) return node.flatMap(all);
    return node && typeof node === 'object' ? [node, ...all(node.props.children)] : [];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    return node?.props ? text(node.props.children) : '';
  }
  render();
  return {
    render, calls, providerMounts, providerUnmounts, appListeners, all: () => all(tree), text: () => text(tree),
    params: () => JSON.parse(JSON.stringify(params)),
    node: type => all(tree).find(node => node.type === type),
    press(label) { const node = all(tree).find(node => node.props.accessibilityLabel === label); assert.ok(node, `Missing action ${label}`); node.props.onPress(); render(); },
    focus(value) { isFocused = value; render(); },
    state(value) { nativeState.currentState = value; appListeners.forEach(listener => listener(value)); render(); },
    hydrate() { serverRendering = false; render(); },
    tick() { if (!paused && isFocused && nativeState.currentState === 'active') feed.tick(feed.getSnapshot().asOf + 1000); render(); },
    unmount() { for (const record of instances.values()) record.slots.forEach(slot => slot?.cleanup?.()); instances.clear(); },
  };
}

test('Trade defaults to an in-app moving simulator with explicit simulation labels', () => {
  const h = fixture();
  assert.equal(h.node('ProviderChart'), undefined);
  assert.equal(h.node('TradingChart').props.asset.symbol, 'EUR/USD');
  assert.ok(h.node('OrderBottomSheet'));
  assert.ok(h.text().includes('SIMULATED'));
  assert.ok(h.text().includes('No live market feed'));
  assert.ok(!h.text().includes('Fixed demo quote'));
  assert.deepEqual(h.providerMounts, []);
  const before = h.node('TradingChart').props.asset.price;
  h.tick();
  const chart = h.node('TradingChart');
  assert.notEqual(chart.props.asset.price, before);
  assert.equal(chart.props.asset.price, chart.props.external.candles.at(-1).close);
  assert.equal(chart.props.asset.price, h.node('OrderBottomSheet').props.asset.price);
  assert.equal(chart.props.keyLevels.length, 5);
  h.press('Pause simulated market');
  const pausedPrice = h.node('TradingChart').props.asset.price;
  h.tick();
  assert.equal(h.node('TradingChart').props.asset.price, pausedPrice);
  h.press('Resume simulated market'); h.tick();
  assert.notEqual(h.node('TradingChart').props.asset.price, pausedPrice);
  h.unmount();
});

test('a provider loading failure stays on provider mode without inventing a sample fallback', () => {
  const h = fixture({ mode: 'markets' }, { providerError: true });
  assert.ok(h.text().includes('Provider chart could not be loaded'));
  assert.equal(h.node('TradingChart'), undefined);
  assert.equal(h.node('OrderBottomSheet'), undefined);
  assert.deepEqual(h.params(), { mode: 'markets' });
  h.unmount();
});

test('explicit provider mode can enter the moving simulator with the selected market', () => {
  const h = fixture({ mode: 'markets' });
  h.press('Show BTC/USD provider chart');
  assert.equal(h.node('ProviderChart').props.symbol, 'BTC/USD');
  h.press('Open practice with simulated prices and virtual funds');
  assert.deepEqual(h.params(), { mode: 'sample', symbol: 'BTC/USD' });
  assert.equal(h.node('ProviderChart'), undefined);
  assert.equal(h.node('TradingChart').props.asset.symbol, 'BTC/USD');
  assert.ok(h.text().includes('Moving simulated prices'));
  assert.ok(!h.text().includes('Fixed demo quote'));
  assert.equal(h.appListeners.size, 0, 'the provider screen must unmount in simulator mode');
  const rail = h.all().find(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel?.startsWith('EUR/USD,'));
  assert.ok(rail);
  rail.props.onPress(); h.render();
  assert.equal(h.node('TradingChart').props.asset.symbol, 'EUR/USD');
  assert.equal(h.node('ProviderChart'), undefined);
  assert.equal(h.all().find(node => node.props.accessibilityLabel === 'Return to provider market charts'), undefined);
  h.unmount();
});

test('invalid symbols select a supported demo market unless provider mode was explicit', () => {
  for (const mode of ['unexpected', ['sample']]) {
    const h = fixture({ mode, symbol: 'unsupported' });
    assert.equal(h.node('TradingChart').props.asset.symbol, 'EUR/USD');
    assert.equal(h.node('ProviderChart'), undefined);
    h.unmount();
  }
  const h = fixture({ mode: 'markets', symbol: 'unsupported' });
  assert.equal(h.node('ProviderChart').props.symbol, 'EUR/USD');
  h.unmount();
});

test('leaving the screen or backgrounding unmounts the provider chart and preserves selection', () => {
  const h = fixture({ mode: 'markets' });
  h.press('Show USD/JPY provider chart');
  assert.equal(h.node('ProviderChart').props.symbol, 'USD/JPY');
  h.focus(false);
  assert.equal(h.node('ProviderChart'), undefined);
  assert.ok(h.text().includes('Chart paused'));
  assert.ok(h.providerUnmounts.includes('USD/JPY'));
  h.focus(true);
  assert.equal(h.node('ProviderChart').props.symbol, 'USD/JPY');
  h.state('background');
  assert.equal(h.node('ProviderChart'), undefined);
  h.state('active');
  assert.equal(h.node('ProviderChart').props.symbol, 'USD/JPY');
  h.unmount();
  assert.equal(h.appListeners.size, 0);
});

test('initially backgrounded screens do not mount provider data until active', () => {
  const h = fixture({ mode: 'markets' }, { appState: 'background' });
  assert.equal(h.node('ProviderChart'), undefined);
  assert.deepEqual(h.providerMounts, []);
  h.state('active');
  assert.equal(h.node('ProviderChart').props.symbol, 'EUR/USD');
  h.unmount();
});

test('server rendering leaves third-party charts unmounted until the client hydrates', () => {
  const h = fixture({ mode: 'markets' }, { serverRendering: true });
  assert.equal(h.node('ProviderChart'), undefined);
  assert.deepEqual(h.providerMounts, []);
  assert.equal(h.appListeners.size, 0);
  assert.ok(h.text().includes('Preparing provider chart'));
  h.hydrate();
  assert.equal(h.node('ProviderChart').props.symbol, 'EUR/USD');
  assert.deepEqual(h.providerMounts, ['EUR/USD']);
  assert.equal(h.appListeners.size, 1);
  h.unmount();
  assert.equal(h.appListeners.size, 0);
});

test('standalone market charts enter explicit practice mode with the selected symbol', () => {
  const h = fixture({}, { standalone: true });
  h.press('Show WTI/USD provider chart');
  h.press('Open practice with simulated prices and virtual funds');
  const push = h.calls.find(call => call.action === 'push');
  assert.deepEqual(JSON.parse(JSON.stringify(push.route)), { pathname: '/(tabs)/practice', params: { mode: 'sample', symbol: 'WTI/USD' } });
  h.unmount();
});
