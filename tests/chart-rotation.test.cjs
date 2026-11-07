const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, Date, Math, Number, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return module.exports;
}
const math = load('src/lib/chartViewport.ts');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// Reuse the established native-gesture simulator without registering or changing
// its tests. It runs the actual useChartGestures hook and its lifecycle effects.
const gestureModule = { exports: {} };
vm.runInNewContext(`${fs.readFileSync('tests/chart-gestures.test.cjs', 'utf8')}\nmodule.exports = { harness };`, {
  module: gestureModule, exports: gestureModule.exports,
  require: name => name === 'node:test' ? { test() {} } : require(name),
});
const { harness } = gestureModule.exports;

test('portrait/landscape resize preserves inspected candle and cursor price while stopping stale recognition', () => {
  const h = harness({ plotWidth: 320, plotHeight: 240, top: 16 });
  const viewport = h.options.viewport.get();
  h.fire('inspection', 'onActivate', { x: 104, y: 70 });
  const oldFinalizer = h.find('inspection').config.onFinalize;
  const oldPanUpdate = h.find('pan').config.onUpdate;
  const before = h.options.crosshair.get();
  const index = Math.round(viewport.start + (before.x - 8) / 320 * (viewport.count - 1));
  const prepared = math.prepareChartData(h.options.candles.get());
  const oldGeometry = math.buildChartGeometry(prepared, viewport, { left: 8, top: 16, width: 320, height: 240, precision: 2 }, false);
  const price = oldGeometry.high - (before.y - 16) / 240 * (oldGeometry.high - oldGeometry.low);
  h.render({ plotWidth: 640, plotHeight: 160 });
  const after = h.options.crosshair.get();
  assert.equal(after.active, true);
  assert.equal(h.options.viewport.get(), viewport, 'Resize must not write a new data viewport');
  assert.equal(Math.round(viewport.start + (after.x - 8) / 640 * (viewport.count - 1)), index);
  const geometry = math.buildChartGeometry(prepared, viewport, { left: 8, top: 16, width: 640, height: 160, precision: 2 }, false);
  near(geometry.high - (after.y - 16) / 160 * (geometry.high - geometry.low), price);
  assert.equal(h.options.interacting.get(), true, 'A pinned inspection must not follow the latest bar');
  oldFinalizer();
  oldPanUpdate({ changeX: 200, numberOfPointers: 1 });
  assert.equal(h.options.crosshair.get().active, true, 'A stale gesture finalizer must not erase the preserved inspection');
  assert.equal(h.options.viewport.get(), viewport);
  h.render({ plotWidth: 320, plotHeight: 240 });
  near(h.options.crosshair.get().x, before.x);
  near(h.options.crosshair.get().y, before.y);
  h.result.cancelInteractions();
  assert.equal(h.options.crosshair.get().active, false);
  assert.equal(h.options.interacting.get(), false);
});

test('height-only resize reprojects inspection and width/height resize cancels momentum without resetting zoom', () => {
  const h = harness({ plotWidth: 320, plotHeight: 240, top: 16 });
  h.fire('inspection', 'onActivate', { x: 160, y: 136 });
  h.render({ plotHeight: 120 });
  near(h.options.crosshair.get().x, 160);
  near(h.options.crosshair.get().y, 76);
  h.result.cancelInteractions();
  h.momentum();
  const viewport = h.options.viewport.get();
  const animation = h.animations.at(-1);
  h.render({ plotWidth: 640, plotHeight: 180 });
  assert.equal(animation.canceled, true);
  assert.equal(h.options.viewport.get(), viewport);
  assert.equal(h.options.interacting.get(), false);
});

test('preserved inspection still clears on blur, disabled state and invalid layout', () => {
  for (const stop of ['blur', 'disabled', 'invalid']) {
    const h = harness({ plotWidth: 320, plotHeight: 240, top: 16 });
    h.fire('inspection', 'onActivate', { x: 104, y: 70 });
    h.render({ plotWidth: 640, plotHeight: 160 });
    if (stop === 'blur') h.focus(false);
    if (stop === 'disabled') h.render({ enabled: false });
    if (stop === 'invalid') h.render({ plotWidth: 0 });
    assert.equal(h.options.crosshair.get().active, false, stop);
    assert.equal(h.options.interacting.get(), false, stop);
  }
});

function walk(node, predicate, result = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, predicate, result));
  else if (node && typeof node === 'object' && node.props) {
    if (predicate(node)) result.push(node);
    walk(typeof node.type === 'function' ? node.type(node.props) : node.props.children, predicate, result);
  }
  return result;
}
function chartFixture() {
  const slots = [];
  const calls = [];
  let cursor = 0;
  const react = { Fragment: Symbol('Fragment'), useEffect() {},
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.length === 1 ? children[0] : children } }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
  };
  react.default = react;
  const controller = { prepared: { value: {} }, viewport: { value: { start: 31.5, count: 25.5 } }, candles: { value: [] }, crosshair: { value: { active: true, x: 100, y: 50 } }, interacting: { value: true }, controls: { canEarlier: true, canLater: true, canZoomIn: true, canZoomOut: true }, reset() {}, zoomIn() {}, zoomOut() {}, panEarlier() {}, panLater() {} };
  const colors = { text: '#202622', sheetText: '#202622', primary: '#202622', border: '#ddd', sub: '#62695F', raised: '#eee', onPrimary: '#fff', up: '#18754D', down: '#B33F48' };
  const { TradingChart } = load('src/components/TradingChart.tsx', {
    '@expo/vector-icons': { Ionicons: 'Icon' }, react, 'react-native': { View: 'View', Pressable: 'Pressable' }, 'expo-router': { useIsFocused: () => true },
    '../lib/market': { marketData: {} }, '../lib/theme': { useTheme: () => ({ colors }) }, '../lib/tradeTheme': load('src/lib/tradeTheme.ts'),
    '../lib/useReducedMotion': { useReducedMotion: () => true }, './ContentState': { ContentState: 'ContentState' },
    './InteractiveChartPlot': { InteractiveChartPlot: 'InteractiveChartPlot', ChartReadout: 'ChartReadout' },
    './useChartController': { useChartController: props => { calls.push(['controller', props]); return controller; } },
    './useChartGestures': { useChartGestures: props => { calls.push(['gesture', props]); return { gesture: {}, cancelInteractions: preserve => calls.push(['cancel', preserve]) }; } },
    './design': { AppButton: 'AppButton', Label: 'Label', Row: 'Row', Sheet: 'Sheet' }, './SegmentedControl': { SegmentedControl: 'SegmentedControl' },
  });
  const props = { asset: { symbol: 'EUR/USD', price: 1.1, precision: 5 }, presentation: 'trade', referenceUI: true, fill: true, fullScreen: false, onFullScreenChange: next => calls.push(['fullscreen', next]),
    external: { candles: [{ time: 100, open: 1, close: 1.1, high: 1.2, low: 0.9 }], timeframe: '15m', moving: true, loading: false, error: '', sample: true, onRetry() {}, onTimeframeChange() {} } };
  function render(patch = {}) { Object.assign(props, patch); cursor = 0; return TradingChart(props); }
  function measure(tree, width, height, toolbar = 44) {
    tree.props.onLayout({ nativeEvent: { layout: { height } } });
    walk(tree, node => node.props.accessibilityLabel?.includes('Pinch to zoom'))[0].props.onLayout({ nativeEvent: { layout: { width } } });
    const toolbarNode = tree.props.children[0];
    toolbarNode.props.onLayout({ nativeEvent: { layout: { height: toolbar } } });
  }
  return { render, measure, controller, calls };
}

test('one mounted chart fills resized bounds and keeps viewport, timeframe, mode and MA through fullscreen', () => {
  const h = chartFixture();
  let tree = h.render();
  h.measure(tree, 320, 400);
  tree = h.render();
  walk(tree, node => node.props.accessibilityLabel === 'Switch to line chart')[0].props.onPress();
  walk(tree, node => node.props.label === 'Show 7-period moving average')[0].props.onPress();
  tree = h.render();
  let plot = walk(tree, node => node.type === 'InteractiveChartPlot')[0];
  assert.equal(plot.props.height, 348);
  assert.equal(plot.props.mode, 'Line');
  assert.equal(plot.props.average, true);
  const viewport = plot.props.viewport;
  walk(tree, node => node.props.accessibilityLabel === 'Open full-screen chart')[0].props.onPress();
  assert.deepEqual(h.calls.slice(-2), [['cancel', true], ['fullscreen', true]]);
  tree = h.render({ fullScreen: true });
  h.measure(tree, 720, 300);
  tree = h.render();
  plot = walk(tree, node => node.type === 'InteractiveChartPlot')[0];
  assert.equal(plot.props.height, 248);
  assert.equal(plot.props.width, 720);
  assert.equal(plot.props.frame, '15m');
  assert.equal(plot.props.mode, 'Line');
  assert.equal(plot.props.average, true);
  assert.equal(plot.props.viewport, viewport);
  assert.deepEqual(viewport.value, { start: 31.5, count: 25.5 });
  h.measure(tree, 720, 300, 88);
  tree = h.render();
  assert.equal(walk(tree, node => node.type === 'InteractiveChartPlot')[0].props.height, 204, 'Measured wrapping/large-text controls retain their own space');
  walk(tree, node => node.props.accessibilityLabel === 'Exit full-screen chart')[0].props.onPress();
  assert.deepEqual(h.calls.slice(-2), [['cancel', true], ['fullscreen', false]]);
  tree = h.render({ fullScreen: false });
  h.measure(tree, 320, 500);
  tree = h.render();
  plot = walk(tree, node => node.type === 'InteractiveChartPlot')[0];
  assert.equal(plot.props.height, 448);
  assert.equal(plot.props.mode, 'Line');
  assert.equal(plot.props.average, true);
  assert.equal(plot.props.viewport, viewport);
  assert.ok(h.calls.filter(call => call[0] === 'controller').every(call => call[1].identity === 'EUR/USD:15m' && call[1].initialCount === 80));
});
