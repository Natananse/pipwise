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
const tokens = load('src/lib/tradeTheme.ts');
const { tradeColors } = tokens;
const colors = { text: '#F4F3EF', sheetText: '#0D1011', primary: '#C8F169', border: '#2A3032', sub: '#A3AAA7', raised: '#1D2224', onPrimary: '#0D1011', up: '#C8F169', down: '#F08A82' };
function walk(node, predicate, ancestors = [], result = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, predicate, ancestors, result));
  else if (node && typeof node === 'object' && node.props) {
    if (predicate(node, ancestors)) result.push(node);
    const children = typeof node.type === 'function' ? node.type(node.props) : node.props.children;
    walk(children, predicate, [...ancestors, node], result);
  }
  return result;
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function fixture(presentation = 'trade', externalOverrides = {}) {
  const calls = [];
  const states = [];
  let cursor = 0;
  const react = {
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.length === 1 ? children[0] : children } }; },
    useEffect() {},
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
  };
  react.default = react;
  const controller = {
    prepared: { value: {} }, viewport: { value: { start: 0, count: 24 } }, candles: { value: [] },
    crosshair: { value: { active: false, x: 0, y: 0 } }, interacting: { value: false },
    controls: { canEarlier: true, canLater: true, canZoomIn: true, canZoomOut: true },
  };
  for (const name of ['zoomIn', 'zoomOut', 'panEarlier', 'panLater', 'reset']) controller[name] = () => calls.push(name);
  const gesture = { kind: 'unchanged-gesture' };
  const { TradingChart } = load('src/components/TradingChart.tsx', {
    '@expo/vector-icons': { Ionicons: 'Icon' }, react,
    'react-native': { Pressable: 'Pressable', View: 'View' },
    'expo-router': { useIsFocused: () => true },
    '../lib/market': { marketData: { candles() { throw new Error('External chart must not request data'); } } },
    '../lib/theme': { useTheme: () => ({ colors }) },
    '../lib/tradeTheme': tokens,
    '../lib/useReducedMotion': { useReducedMotion: () => false },
    './ContentState': { ContentState: 'ContentState' },
    './InteractiveChartPlot': { ChartReadout: 'ChartReadout', InteractiveChartPlot: 'InteractiveChartPlot' },
    './useChartController': { useChartController: options => { calls.push(['controller', options]); return controller; } },
    './useChartGestures': { useChartGestures: options => { calls.push(['gesture', options]); return { gesture, cancelInteractions: () => calls.push('cancelInteractions') }; } },
    './design': { AppButton: 'AppButton', Label: 'Label', Row: 'Row', Sheet: 'Sheet' },
    './SegmentedControl': { SegmentedControl: 'SegmentedControl' },
  });
  const asset = { symbol: 'EUR/USD', price: 1.1, precision: 5 };
  const candles = [{ time: 1000, open: 1, close: 1.1, high: 1.2, low: 0.9 }];
  const levels = [{ label: 'Support · 20 bars', price: 1, color: '#6EE7BE' }, { label: 'Pivot · prior bar', price: 1.05, color: '#E8D884' }];
  function render() {
    cursor = 0;
    return TradingChart({ asset, presentation, referenceUI: true, terminal: true, accentColor: '#FE80AB', keyLevels: levels,
      external: { candles, timeframe: '1m', loading: false, error: '', sample: true, moving: true, onRetry() {}, onTimeframeChange: frame => calls.push(['frame', frame]), ...externalOverrides } });
  }
  return { render, calls, controller, gesture, levels };
}
const find = (tree, type) => walk(tree, node => node.type === type)[0];
const outsideSheets = (node, ancestors) => ancestors.every(parent => parent.type !== 'Sheet');

test('Trade chart forces its light paint over legacy terminal and asset accents without altering shared defaults', () => {
  const h = fixture();
  const tree = h.render();
  const plot = find(tree, 'InteractiveChartPlot');
  assert.equal(plot.props.terminal, false);
  assert.equal(plot.props.axisFontSize, 11);
  assert.equal(plot.props.averageColor, tradeColors.average);
  assert.equal(plot.props.plotW, 240, 'Trade reserves a wider price axis for readable text');
  assert.equal(plot.props.paint.line, tradeColors.text);
  assert.equal(plot.props.paint.price, tradeColors.primary);
  assert.equal(plot.props.paint.onPrice, tradeColors.onPrimary);
  assert.equal(plot.props.paint.grid, tradeColors.grid);
  assert.equal(plot.props.paint.axis, tradeColors.sub);
  assert.equal(plot.props.paint.up, tradeColors.up);
  assert.equal(plot.props.paint.down, tradeColors.down);
  assert.equal(plot.props.levels[0].color, tradeColors.up);
  assert.equal(plot.props.levels[1].color, tradeColors.sub);
  assert.equal(h.levels[0].color, '#6EE7BE', 'Source levels must not be mutated');
  const control = walk(tree, node => node.props.accessibilityLabel === 'Change chart timeframe')[0];
  assert.equal(control.props.style({ pressed: false }).backgroundColor, tradeColors.raised);
  assert.ok(control.props.style({ pressed: false }).minHeight >= 44);
  const readout = find(tree, 'ChartReadout');
  assert.equal(readout.props.inspectionOnly, true);
  assert.equal(readout.props.muted, tradeColors.sub);
  assert.equal(plot.props.gesture, h.gesture);
  assert.equal(plot.props.prepared, h.controller.prepared);
  assert.equal(plot.props.viewport, h.controller.viewport);

  const ordinary = fixture('default').render();
  const ordinaryPlot = find(ordinary, 'InteractiveChartPlot');
  assert.equal(ordinaryPlot.props.terminal, true);
  assert.equal(ordinaryPlot.props.axisFontSize, 9);
  assert.equal(ordinaryPlot.props.averageColor, undefined);
  assert.equal(ordinaryPlot.props.plotW, 248);
  assert.equal(ordinaryPlot.props.paint.line, '#FE80AB');
  assert.equal(ordinaryPlot.props.paint.grid, '#29332D');
  assert.equal(ordinaryPlot.props.paint.up, '#6EE7BE');
  assert.equal(find(ordinary, 'ChartReadout').props.inspectionOnly, false);
  assert.equal(find(ordinary, 'ChartReadout').props.up, colors.up);
});

test('Trade inspection overlays the fixed plot after its renderer so holding cannot move chart geometry', () => {
  const tree = fixture().render();
  const plot = find(tree, 'InteractiveChartPlot');
  const readout = find(tree, 'ChartReadout');
  const plotParent = walk(tree, node => node.type === 'View' && typeof node.props.onLayout === 'function')[0];
  assert.equal(plotParent.props.style.height, plot.props.height);
  const children = [plotParent.props.children].flat(Infinity).filter(Boolean);
  assert.ok(children.includes(plot), 'The gesture plot stays in the measured, fixed-height container');
  assert.ok(children.indexOf(readout) > children.indexOf(plot), 'The inspection overlay follows the plot inside that same container');
  assert.equal(walk(tree, node => node.type === 'ChartReadout').length, 1);
  assert.equal(readout.props.inspectionOnly, true);
  const ordinary = fixture('default').render();
  const ordinaryParent = walk(ordinary, node => node.type === 'View' && typeof node.props.onLayout === 'function')[0];
  assert.equal(walk(ordinaryParent, node => node.type === 'ChartReadout').length, 0, 'Other contexts retain their separate readout');
});

test('Trade removes permanent caption/reset while retaining accessible timeframe, type and complete tools', () => {
  const h = fixture();
  const tree = h.render();
  const visible = walk(tree, (node, ancestors) => outsideSheets(node, ancestors));
  assert.ok(!visible.some(node => text(node) === 'PRICE ACTION'));
  assert.ok(!visible.some(node => node.props.accessibilityLabel === 'Reset chart view'));
  for (const label of ['Change chart timeframe', 'Switch to line chart', 'Chart indicators and controls']) {
    assert.ok(visible.some(node => node.props.accessibilityLabel === label), label);
  }
  const reset = walk(tree, (node, ancestors) => node.props.accessibilityLabel === 'Reset chart view' && ancestors.some(parent => parent.type === 'Sheet'))[0];
  assert.ok(reset, 'Reset remains in the chart tools sheet');
  reset.props.onPress();
  assert.deepEqual(h.calls.slice(-2), ['cancelInteractions', 'reset']);
  const zoom = walk(tree, node => node.props.accessibilityLabel === 'Zoom in')[0];
  zoom.props.onPress();
  assert.deepEqual(h.calls.slice(-2), ['cancelInteractions', 'zoomIn']);
  const average = walk(tree, node => node.props.label === 'Show 7-period moving average')[0];
  average.props.onPress();
  assert.equal(find(h.render(), 'InteractiveChartPlot').props.average, true);
  assert.ok(walk(tree, node => node.type === 'Label' && /Reference levels\s*·\s*1m/.test(text(node))).length);
  assert.doesNotMatch(text(tree), /The moving average smooths|Support and resistance use|Simulated history \+ forming bar/);
  const frameControl = walk(tree, node => node.props.accessibilityLabel === 'Change chart timeframe')[0];
  frameControl.props.onPress();
  const frameSheet = walk(h.render(), node => node.type === 'Sheet' && node.props.title === 'Chart timeframe')[0];
  assert.equal(frameSheet.props.visible, true);
  walk(frameSheet, node => node.props.label === '5m')[0].props.onPress();
  assert.ok(h.calls.some(call => Array.isArray(call) && call[0] === 'frame' && call[1] === '5m'));
  const defaultTree = fixture('default').render();
  assert.ok(walk(defaultTree, (node, ancestors) => outsideSheets(node, ancestors) && node.props.accessibilityLabel === 'Reset chart view').length);
  assert.ok(walk(defaultTree, node => node.type === 'Label' && text(node) === 'PRICE ACTION').length);
  assert.match(text(defaultTree), /The moving average smooths/);
});

test('Trade loading, error and empty chart states request light presentation', () => {
  for (const overrides of [{ loading: true }, { error: 'Unavailable' }, { candles: [] }]) {
    const state = find(fixture('trade', overrides).render(), 'ContentState');
    assert.equal(state.props.tone, 'light');
  }
});

test('Trade tokens keep readable text/actions and an eight-point spacing scale without changing global themes', () => {
  function luminance(color) {
    const channels = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  function contrast(first, second) {
    const light = Math.max(luminance(first), luminance(second));
    const dark = Math.min(luminance(first), luminance(second));
    return (light + 0.05) / (dark + 0.05);
  }
  assert.equal(tradeColors.bg, '#F7F5EF');
  for (const foreground of ['text', 'sub', 'up', 'down', 'average']) {
    for (const background of ['bg', 'surface']) assert.ok(contrast(tradeColors[foreground], tradeColors[background]) >= 4.5, `${foreground}/${background}`);
  }
  assert.ok(contrast(tradeColors.onPrimary, tradeColors.primary) >= 7);
  assert.ok(contrast(tradeColors.sellText, tradeColors.sell) >= 7);
  assert.ok(Object.values(tokens.tradeSpace).every(value => value % 8 === 0));
  assert.ok(!fs.readFileSync('src/lib/tradeTheme.ts', 'utf8').includes('ThemeProvider'));
});
