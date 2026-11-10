const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function walk(node, predicate, found = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, predicate, found));
  else if (node && typeof node === 'object' && node.props) {
    if (predicate(node)) found.push(node);
    walk(typeof node.type === 'function' ? node.type(node.props) : node.props.children, predicate, found);
  }
  return found;
}

const candle = { time: 1000, open: 1, high: 1.2, low: 0.9, close: 1.1 };
const external = overrides => ({ candles: [candle], timeframe: '1h', loading: false, error: '', sample: true, onTimeframeChange() {}, onRetry() {}, ...overrides });

function fixture(initial = {}) {
  const states = [], effects = [], requests = [], gestureCalls = [];
  let cursor = 0, pending = [];
  const react = {
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.length === 1 ? children[0] : children } }; },
    useState(value) {
      const index = cursor++;
      if (!(index in states)) states[index] = value;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect(callback, dependencies) {
      const index = cursor++, previous = effects[index];
      if (!previous || dependencies.some((dependency, i) => dependency !== previous.dependencies[i])) {
        pending.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() }; });
      }
    },
  };
  react.default = react;
  const colors = { text: '#111', sheetText: '#111', primary: '#123', border: '#ddd', sub: '#777', raised: '#eee', onPrimary: '#fff', up: '#080', down: '#800' };
  const controller = { prepared: {}, viewport: {}, crosshair: {}, candles: {}, interacting: {}, controls: { canEarlier: true, canLater: true, canZoomIn: true, canZoomOut: true }, zoomIn() {}, zoomOut() {}, panEarlier() {}, panLater() {}, reset() {} };
  const cancelInteractions = () => {};
  const imports = {
    react, '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native': { View: 'View', Pressable: 'Pressable' },
    'expo-router': { useIsFocused: () => true },
    '../lib/market': { marketData: { candles(asset, timeframe) { return new Promise((resolve, reject) => requests.push({ symbol: asset.symbol, timeframe, resolve, reject })); } } },
    '../lib/theme': { useTheme: () => ({ colors }) },
    '../lib/tradeTheme': { tradeColors: {}, tradeRadii: {}, tradeSpace: {} },
    '../lib/useReducedMotion': { useReducedMotion: () => false },
    './ContentState': { ContentState: 'ContentState' },
    './InteractiveChartPlot': { ChartReadout: 'ChartReadout', InteractiveChartPlot: 'InteractiveChartPlot' },
    './useChartController': { useChartController: () => controller },
    './useChartGestures': { useChartGestures: options => { gestureCalls.push(options); return { gesture: {}, cancelInteractions }; } },
    './design': { AppButton: 'AppButton', Label: 'Label', Row: 'Row', Sheet: 'Sheet' },
    './SegmentedControl': { SegmentedControl: 'SegmentedControl' },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/TradingChart.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, require(name) { assert.ok(name in imports, name); return imports[name]; } });
  let props = { asset: { symbol: 'EUR/USD', price: 1.1, precision: 5 }, referenceUI: true, ...initial };
  return {
    requests, gestureCalls,
    render(patch = {}) {
      props = { ...props, ...patch }; cursor = 0; pending = [];
      const tree = module.exports.TradingChart(props);
      pending.forEach(effect => effect());
      return tree;
    },
    async settle() { await Promise.resolve(); await Promise.resolve(); },
  };
}

test('loading, failed and empty charts hide old OHLC and disable navigation controls', () => {
  for (const overrides of [{ loading: true }, { error: 'Feed unavailable' }, { candles: [] }]) {
    const h = fixture({ external: external() });
    assert.equal(walk(h.render(), node => node.type === 'ChartReadout').length, 1);
    const tree = h.render({ external: external(overrides) });
    assert.equal(walk(tree, node => node.type === 'ChartReadout').length, 0);
    assert.equal(walk(tree, node => node.type === 'InteractiveChartPlot').length, 0);
    assert.equal(h.gestureCalls.at(-1).enabled, false);
    const controls = walk(tree, node => ['Pan to earlier candles', 'Pan to later candles', 'Zoom in', 'Zoom out', 'Reset chart view'].includes(node.props.accessibilityLabel));
    assert.equal(controls.length, 6);
    assert.ok(controls.every(node => node.props.disabled && node.props.accessibilityState.disabled));
  }
});

test('opening a chart sheet keeps recognizers disabled until the sheet closes', () => {
  for (const label of ['Chart indicators and controls', 'Change chart timeframe']) {
    const h = fixture({ external: external() });
    let tree = h.render();
    assert.equal(h.gestureCalls.at(-1).enabled, true);
    walk(tree, node => node.props.accessibilityLabel === label)[0].props.onPress();
    tree = h.render();
    assert.equal(h.gestureCalls.at(-1).enabled, false);
    const sheet = walk(tree, node => node.type === 'Sheet' && node.props.visible)[0];
    sheet.props.onClose();
    h.render();
    assert.equal(h.gestureCalls.at(-1).enabled, true);
  }
});

test('changing the internally fetched asset hides its prior candles immediately and handles failure/retry', async () => {
  const h = fixture();
  assert.equal(walk(h.render(), node => node.type === 'ContentState')[0].props.kind, 'skeleton');
  h.requests[0].resolve([candle]);
  await h.settle();
  assert.equal(walk(h.render(), node => node.type === 'InteractiveChartPlot').length, 1);
  const nextAsset = { symbol: 'BTC/USD', price: 70000, precision: 2 };
  let tree = h.render({ asset: nextAsset });
  assert.equal(walk(tree, node => node.type === 'ContentState')[0].props.kind, 'skeleton');
  assert.equal(walk(tree, node => node.type === 'ChartReadout').length, 0);
  assert.equal(h.gestureCalls.at(-1).enabled, false);
  h.requests[1].reject(new Error('offline'));
  await h.settle();
  tree = h.render();
  const failed = walk(tree, node => node.type === 'ContentState')[0];
  assert.equal(failed.props.kind, 'error');
  failed.props.onRetry();
  tree = h.render();
  assert.equal(walk(tree, node => node.type === 'ContentState')[0].props.kind, 'skeleton');
  h.requests[2].resolve([{ ...candle, close: 70000 }]);
  await h.settle();
  tree = h.render();
  assert.equal(walk(tree, node => node.type === 'InteractiveChartPlot').length, 1);
  assert.equal(h.gestureCalls.at(-1).enabled, true);
});
