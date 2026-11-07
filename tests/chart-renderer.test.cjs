const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }, ...globals });
  return module.exports;
}

function walk(node, predicate, ancestors = [], result = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, predicate, ancestors, result));
  else if (node && typeof node === 'object' && node.props) {
    if (predicate(node, ancestors)) result.push(node);
    walk(node.props.children, predicate, [...ancestors, node], result);
  }
  return result;
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function candles(length) {
  return Array.from({ length }, (_, i) => {
    const close = 200 + i;
    return { time: Date.UTC(2026, 10, 1) + i * 86400000, open: close + (i % 2 ? -1 : 1), high: close + 3, low: close - 3, close };
  });
}

// Runs the actual renderer/readout functions with deterministic hook lifetimes,
// UI reactions and delayed completions. It does not model native SVG or touch delivery.
function fixture({ length = 40, viewport = { start: 2.3, count: 12.4 }, frame = '1h', reducedMotion = false } = {}) {
  const math = load('src/lib/chartViewport.ts');
  const records = [], rnJobs = [], timers = new Map(), delayCalls = [];
  let current, now = 1000, revision = 0, publications = 0, cancelled = 0;
  const dependencyChange = (old, deps) => !old || !deps || deps.some((dep, i) => dep !== old.deps[i]);
  const react = {
    Fragment: Symbol('Fragment'), memo: component => component,
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.length === 1 ? children[0] : children } }; },
    useId() {
      const index = current.cursor++;
      return (current.slots[index] ??= `:chart-${records.indexOf(current)}-${index}:`);
    },
    useState(initial) {
      const record = current, index = current.cursor++;
      if (!record.slots[index]) record.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [record.slots[index].value, next => {
        const previous = record.slots[index].value;
        record.slots[index].value = typeof next === 'function' ? next(previous) : next;
        record.dirty ||= previous !== record.slots[index].value;
      }];
    },
    useEffect(callback, deps) {
      const record = current, index = record.cursor++, previous = record.slots[index];
      if (dependencyChange(previous, deps)) record.effects.push(() => {
        previous?.cleanup?.(); record.slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  react.default = react;
  function cancelAnimation(shared) {
    const timer = timers.get(shared);
    if (timer) { cancelled++; timers.delete(shared); timer.animation.callback?.(false); }
  }
  function shared(initial) {
    let saved = initial;
    const value = {
      get value() { return saved; },
      set value(next) { value.set(next); },
      get() { return saved; },
      set(next) {
        cancelAnimation(value);
        if (next?.kind === 'delay') {
          const delay = reducedMotion && next.reduceMotion !== 'never' ? 0 : next.delay;
          timers.set(value, { due: now + delay, animation: next.animation, finish() { saved = next.animation.to; } });
        } else saved = typeof next === 'function' ? next(saved) : next;
      },
    };
    return value;
  }
  const reanimated = {
    __esModule: true,
    default: { createAnimatedComponent: component => `Animated.${component}` },
    ReduceMotion: { Never: 'never', System: 'system', Always: 'always' },
    cancelAnimation,
    useSharedValue(initial) {
      const index = current.cursor++;
      return (current.slots[index] ??= shared(initial));
    },
    useDerivedValue(callback) {
      const index = current.cursor++;
      if (!current.slots[index]) {
        const slot = { callback, revision: -1, saved: null };
        slot.value = { get value() {
          if (slot.revision !== revision) { slot.saved = slot.callback(); slot.revision = revision; }
          return slot.saved;
        } };
        current.slots[index] = slot;
      }
      current.slots[index].callback = callback;
      return current.slots[index].value;
    },
    useAnimatedProps(callback) { return new Proxy({}, { get: (_target, key) => callback()[key] }); },
    useAnimatedReaction(prepare, callback) {
      const index = current.cursor++;
      current.slots[index] = { ...current.slots[index], prepare, callback };
    },
    withTiming(to, config, callback) { return { kind: 'timing', to, config, callback }; },
    withDelay(delay, animation, reduceMotion) {
      delayCalls.push({ delay, reduceMotion });
      return { kind: 'delay', delay, animation, reduceMotion };
    },
  };
  class Clock extends Date { static now() { return now; } }
  const svg = Object.fromEntries(['Circle', 'ClipPath', 'Defs', 'G', 'Line', 'LinearGradient', 'Path', 'Rect', 'Stop', 'Text'].map(name => [name, name]));
  svg.__esModule = true;
  svg.default = 'Svg';
  const renderer = load('src/components/InteractiveChartPlot.tsx', {
    react, 'react-native': { View: 'View' },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-reanimated': reanimated,
    'react-native-worklets': { scheduleOnRN(callback, ...args) { publications++; rnJobs.push(() => callback(...args)); } },
    'react-native-svg': svg, '../lib/chartViewport': math,
    '../lib/theme': { fonts: { medium: 'Medium', bold: 'Bold' } }, './design': { Label: 'Label' },
  }, { Date: Clock });
  const paint = { line: '#111', price: '#123', onPrice: '#fff', grid: '#ddd', axis: '#888', up: '#0a0', down: '#a00', text: '#222' };
  const values = { prepared: shared(math.prepareChartData(candles(length))), viewport: shared(viewport), crosshair: shared({ active: false, x: 0, y: 0 }) };
  const layout = { width: 360, height: 300, plotW: 280, precision: 2, frame };
  function render(record) {
    current = record; record.cursor = 0; record.effects = []; record.dirty = false;
    record.tree = record.component(record.props);
    record.effects.forEach(effect => effect());
  }
  function mount(component, props) {
    const record = { component, props, slots: [], dirty: true, mounted: true };
    records.push(record); render(record);
    return record;
  }
  function flushRN() {
    while (rnJobs.length) rnJobs.shift()();
    records.filter(record => record.mounted && record.dirty).forEach(render);
  }
  function dueTimers() {
    for (const [owner, timer] of [...timers]) if (timer.due <= now) {
      timers.delete(owner); timer.finish(); timer.animation.callback?.(true);
    }
    flushRN();
  }
  function reactToInputs() {
    revision++;
    for (const record of records) if (record.mounted) for (const slot of record.slots) if (slot?.prepare) {
      const next = slot.prepare(); slot.callback(next, slot.previous ?? null); slot.previous = next;
    }
    dueTimers(); flushRN();
  }
  const plot = mount(renderer.InteractiveChartPlot, { ...values, ...layout, gesture: {}, mode: 'Candles', average: true, terminal: false, area: true, paint, levels: [] });
  const axesNode = walk(plot.tree, node => node.type?.name === 'ChartAxes')[0];
  assert.ok(axesNode, 'Actual plot must include its private axes component');
  const axes = mount(axesNode.type, axesNode.props);
  const readout = mount(renderer.ChartReadout, { ...values, ...layout, axisColor: paint.axis, up: paint.up, down: paint.down, muted: '#999' });
  reactToInputs();
  return {
    plot, axes, readout, paint, values, math, delayCalls,
    get publications() { return publications; }, get cancelled() { return cancelled; }, get timers() { return timers.size; },
    frame(ms, update) { now += ms; update?.(values); reactToInputs(); },
    advance(ms) { now += ms; dueTimers(); },
    setCandles(next) { values.prepared.value = math.prepareChartData(next); reactToInputs(); },
    unmount() { records.forEach(record => { record.mounted = false; record.slots.forEach(slot => slot?.cleanup?.()); }); },
  };
}

test('large histories keep a bounded path tree with clipped geometry and hollow/filled candles', () => {
  const small = fixture({ length: 40 });
  const large = fixture({ length: 10000, viewport: { start: 0, count: 10000 } });
  const paths = node => walk(node, item => item.type === 'Animated.Path');
  assert.equal(paths(large.plot.tree).length, paths(small.plot.tree).length);
  assert.equal(paths(large.plot.tree).length, 5, 'Four candle paths plus one average path');
  const clip = walk(large.plot.tree, node => node.type === 'ClipPath')[0];
  const clipRect = walk(clip, node => node.type === 'Rect')[0];
  assert.equal(clipRect.props.width, 280);
  assert.equal(clipRect.props.height, 252);
  for (const path of paths(large.plot.tree)) {
    assert.ok(walk(large.plot.tree, (node, parents) => node === path && parents.some(parent => parent.type === 'G' && parent.props.clipPath === `url(#${clip.props.id})`)).length);
  }
  const bodies = paths(small.plot.tree).filter(node => node.props.strokeWidth === 0.8);
  assert.equal(bodies.find(node => node.props.stroke === small.paint.up).props.fill, 'none');
  assert.equal(bodies.find(node => node.props.stroke === small.paint.down).props.fill, small.paint.down);
  assert.ok(bodies.every(node => node.props.animatedProps.d.includes('Z')));
  const renderedBars = paths(large.plot.tree).filter(node => node.props.strokeWidth === 0.8)
    .reduce((count, node) => count + (node.props.animatedProps.d.match(/Z/g) || []).length, 0);
  assert.ok(renderedBars <= 180, `Unexpected ${renderedBars} candle bodies for the plot's bounded budget`);
  const priceLabels = walk(large.axes.tree, (node, parents) => node.type === 'Text' && node.props.x > 280 && !parents.some(parent => parent.props.clipPath));
  assert.equal(priceLabels.length, 6, 'Five axis ticks and the price badge remain outside the clip');
});

test('fractional windows use the same final visible candle for the price marker and OHLC', () => {
  const h = fixture();
  const badge = walk(h.axes.tree, node => node.type === 'Text' && node.props.fill === h.paint.onPrice)[0];
  assert.equal(text(badge), '213.00', 'The offscreen continuity neighbor at index 14 must not supply the price');
  assert.match(text(h.readout.tree), /↗ 213\.00/);
  assert.match(text(h.readout.tree), /2026-11-14 00:00 UTC/);
  const priceLine = walk(h.plot.tree, node => node.type === 'Animated.Line' && node.props.stroke === h.paint.price)[0];
  const badgeRect = walk(h.axes.tree, node => node.type === 'Rect' && node.props.fill === h.paint.price)[0];
  assert.ok(Math.abs(badgeRect.props.y + 12 - priceLine.props.animatedProps.y1) < 1e-9);
});

test('daily chart axes show calendar dates and the readout names its UTC date anchor', () => {
  const h = fixture({ viewport: { start: 0, count: 12 }, frame: '1D' });
  const ticks = walk(h.axes.tree, node => node.type === 'Text' && node.props.y === 292).map(text);
  assert.deepEqual(ticks, ['11-01', '11-07', '11-12']);
  assert.match(text(h.readout.tree), /2026-11-12 · UTC date anchor/);
});

test('throttled static readouts publish their final state after 90ms even with system reduced motion', () => {
  const h = fixture({ reducedMotion: true });
  const initial = h.publications;
  h.frame(20, values => { values.viewport.value = { start: 3.3, count: 12.4 }; });
  h.frame(20, values => { values.viewport.value = { start: 4.3, count: 12.4 }; });
  assert.equal(h.publications, initial, 'Text must not publish for every input frame inside the 80ms throttle');
  assert.match(text(h.readout.tree), /213\.00/);
  assert.ok(h.delayCalls.every(call => call.delay === 90 && call.reduceMotion === 'never'));
  assert.ok(h.cancelled >= 4, 'New input cancels the previous axes/readout completion');
  h.advance(89);
  assert.equal(h.publications, initial);
  h.advance(1);
  assert.equal(h.publications, initial + 2, 'Exactly one trailing axes update and one OHLC update');
  assert.match(text(h.readout.tree), /215\.00/);
  const badge = walk(h.axes.tree, node => node.type === 'Text' && node.props.fill === h.paint.onPrice)[0];
  assert.equal(text(badge), '215.00');
  assert.equal(h.timers, 0);
});

test('empty input clears OHLC and cancels old delayed text; unmount removes pending completions', () => {
  const h = fixture();
  h.frame(20, values => { values.viewport.value = { start: 4.3, count: 12.4 }; });
  h.setCandles([]);
  assert.doesNotMatch(text(h.readout.tree), /213\.00|215\.00|Latest visible bar/);
  assert.equal(walk(h.readout.tree, node => node.type === 'Label' && text(node) === '—').length, 4);
  h.advance(100);
  assert.doesNotMatch(text(h.readout.tree), /213\.00|215\.00/);
  h.setCandles(candles(40));
  assert.ok(h.timers > 0);
  h.unmount();
  const before = h.publications;
  h.advance(100);
  assert.equal(h.timers, 0);
  assert.equal(h.publications, before);
});
