const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}

const math = load('src/lib/chartViewport.ts');
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function harness(overrides = {}) {
  const slots = [];
  const listeners = new Set();
  const animations = [];
  let cursor = 0;
  let focused = true;
  let effects = [];
  let result;
  const appState = {
    currentState: 'active',
    addEventListener(name, listener) {
      assert.equal(name, 'change');
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  const makeShared = initial => {
    const value = {
      current: initial,
      animation: null,
      get() { return this.current; },
      set(next) {
        if (next && next.decay) {
          this.animation = { ...next, target: this, canceled: false };
          animations.push(this.animation);
        } else this.current = typeof next === 'function' ? next(this.current) : next;
      },
    };
    return value;
  };
  const react = {
    useState() { assert.fail('Chart gesture frames must not use React state'); },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((dependency, i) => dependency !== previous.dependencies[i])) {
        slots[index] = { kind: 'callback', callback, dependencies };
      }
      return slots[index].callback;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((dependency, i) => dependency !== previous.dependencies[i])) {
        const slot = slots[index] = { kind: 'effect', dependencies };
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
      }
    },
  };
  const gestures = {
    usePanGesture: config => ({ kind: config.activateAfterLongPress ? 'inspection' : 'pan', config }),
    usePinchGesture: config => ({ kind: 'pinch', config }),
    useTapGesture: config => ({ kind: 'doubleTap', config }),
    useSimultaneousGestures: (...children) => ({ kind: 'simultaneous', children }),
    useCompetingGestures: (...children) => ({ kind: 'competing', children }),
  };
  const animated = {
    ReduceMotion: { System: 'system' },
    useSharedValue(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: 'shared', shared: makeShared(initial) };
      return slots[index].shared;
    },
    useAnimatedReaction(prepare, callback) {
      const index = cursor++;
      const previous = slots[index];
      slots[index] = { kind: 'reaction', prepare, callback, last: previous?.last ?? null, key: previous?.key };
    },
    cancelAnimation(value) {
      if (!value.animation || value.animation.canceled) return;
      const animation = value.animation;
      animation.canceled = true;
      value.animation = null;
      animation.callback?.(false, value.get());
    },
    withDecay: (config, callback) => ({ decay: true, config, callback }),
  };
  const api = load('src/components/useChartGestures.ts', {
    react,
    'expo-router': { useIsFocused: () => focused },
    'react-native': { AppState: appState },
    'react-native-gesture-handler': gestures,
    'react-native-reanimated': animated,
    'react-native-worklets': { scheduleOnUI: (callback, ...args) => callback(...args) },
    '../lib/chartViewport': math,
  });
  let options = {
    viewport: makeShared({ start: 100, count: 80 }),
    candles: makeShared(Array.from({ length: 300 }, (_, time) => ({ time, open: 10, high: 12, low: 9, close: 11 }))),
    crosshair: makeShared({ active: false, x: 0, y: 0 }),
    interacting: makeShared(false),
    plotWidth: 320,
    left: 8,
    enabled: true,
    reducedMotion: false,
    ...overrides,
  };
  function flush() {
    for (let turn = 0; turn < 12; turn++) {
      let changed = false;
      for (const slot of slots) {
        if (slot?.kind !== 'reaction') continue;
        const next = slot.prepare();
        const key = JSON.stringify(next);
        if (key === slot.key) continue;
        const previous = slot.last;
        slot.last = next;
        slot.key = key;
        slot.callback(next, previous);
        changed = true;
      }
      if (!changed) return;
    }
    assert.fail('Animated reactions did not settle');
  }
  function render(patch = {}) {
    options = { ...options, ...patch };
    cursor = 0;
    effects = [];
    result = api.useChartGestures(options);
    for (const effect of effects) effect();
    flush();
  }
  function find(kind, gesture = result.gesture) {
    if (gesture.kind === kind) return gesture;
    for (const child of gesture.children || []) { const found = find(kind, child); if (found) return found; }
    return null;
  }
  const h = {
    render, find, flush, animations,
    get result() { return result; },
    get options() { return options; },
    fire(kind, name, event = {}) {
      const callback = find(kind)?.config[name];
      assert.equal(typeof callback, 'function', `${kind}.${name} is missing`);
      callback({ numberOfPointers: 1, canceled: false, x: 168, y: 80, changeX: 0, velocityX: 0, scale: 1, focalX: 168, focalY: 80, ...event });
      flush();
    },
    beginPan() { h.fire('pan', 'onBegin'); h.fire('pan', 'onActivate'); },
    momentum() { h.beginPan(); h.fire('pan', 'onUpdate', { changeX: 20 }); h.fire('pan', 'onDeactivate', { numberOfPointers: 0, velocityX: 640 }); },
    tick(position) {
      const animation = animations.findLast(candidate => !candidate.canceled && candidate.target.animation === candidate);
      assert(animation, 'No decay is running');
      animation.target.current = position;
      flush();
      return animation;
    },
    complete(position) {
      const animation = h.tick(position);
      animation.target.animation = null;
      animation.callback(true, position);
      flush();
    },
    app(state) { appState.currentState = state; for (const listener of listeners) listener(state); flush(); },
    focus(value) { focused = value; render(); },
    unmount() { for (const slot of slots) if (slot?.kind === 'effect') slot.cleanup?.(); flush(); },
    get listeners() { return listeners.size; },
  };
  render();
  return h;
}

test('GH3 composition lets pan and pinch cooperate while inspection and double tap compete', () => {
  const h = harness();
  assert.equal(h.result.gesture.kind, 'competing');
  assert.equal(h.result.gesture.children[0].kind, 'simultaneous');
  assert.deepEqual(h.result.gesture.children[0].children.map(gesture => gesture.kind), ['pan', 'pinch']);
  for (const kind of ['pan', 'pinch', 'inspection', 'doubleTap']) {
    assert.equal(h.find(kind).config.enabled.get(), true);
    assert.equal(h.find(kind).config.cancelsJSResponder, true);
    assert.equal(h.find(kind).config.cancelsTouchesInView, true);
  }
  assert.deepEqual(Array.from(h.find('pan').config.activeOffsetX), [-6, 6]);
  assert.deepEqual(Array.from(h.find('pan').config.failOffsetY), [-10, 10]);
  assert.equal(h.find('inspection').config.activateAfterLongPress, 350);
  assert(h.find('inspection').config.minDistance > 1000, 'inspection activation must come from the hold timer, not immediate distance-zero activation');
});

test('moving-focal pinch keeps its candle anchor and pan handoff drops pointer-change jumps', () => {
  const h = harness();
  h.beginPan();
  const anchor = 100 + 0.25 * 79;
  h.fire('pinch', 'onActivate', { numberOfPointers: 2, focalX: 88 });
  h.fire('pinch', 'onUpdate', { numberOfPointers: 2, scale: 2, focalX: 168 });
  const pinched = h.options.viewport.get();
  near(pinched.start + 0.5 * (pinched.count - 1), anchor);
  near(pinched.count, 40.5);
  h.fire('pan', 'onUpdate', { numberOfPointers: 2, changeX: 120 });
  near(h.options.viewport.get().start, pinched.start);
  h.fire('pinch', 'onFinalize');
  h.fire('pan', 'onUpdate', { numberOfPointers: 1, changeX: 100 });
  near(h.options.viewport.get().start, pinched.start);
  h.fire('pan', 'onUpdate', { numberOfPointers: 1, changeX: 10 });
  const expected = math.panViewport(pinched, 10, 320, 300);
  near(h.options.viewport.get().start, expected.start);
  near(h.options.viewport.get().count, expected.count);
});

test('live-history changes cannot restore a stale pinch-start viewport', () => {
  const h = harness();
  h.fire('pinch', 'onActivate', { numberOfPointers: 2 });
  h.fire('pinch', 'onUpdate', { numberOfPointers: 2, scale: 1.2 });
  const shifted = { ...h.options.viewport.get(), start: h.options.viewport.get().start - 1 };
  h.options.viewport.set(shifted);
  h.options.candles.set(h.options.candles.get().map(candle => ({ ...candle, time: candle.time + 1 })));
  h.flush();
  assert.equal(h.options.interacting.get(), true);
  h.fire('pinch', 'onUpdate', { numberOfPointers: 2, scale: 1.4 });
  const expected = math.zoomViewport(shifted, 1.4 / 1.2, 0.5, 300);
  near(h.options.viewport.get().start, expected.start);
  near(h.options.viewport.get().count, expected.count);
});

test('momentum converts pixels to candle velocity and failed competitors cannot stop the winner', () => {
  const h = harness();
  h.momentum();
  const animation = h.animations.at(-1);
  near(animation.config.velocity, -640 * 79 / 320);
  assert.deepEqual(Array.from(animation.config.clamp), [0, 220]);
  assert.equal(animation.config.rubberBandEffect, false);
  assert.equal(h.options.interacting.get(), true);
  h.fire('pan', 'onFinalize');
  h.fire('pinch', 'onFinalize', { canceled: true });
  h.fire('inspection', 'onFinalize', { canceled: true });
  assert.equal(animation.canceled, false);
  h.tick(90);
  near(h.options.viewport.get().start, 90);
  h.complete(89);
  near(h.options.viewport.get().start, 89);
  assert.equal(h.options.interacting.get(), false);
});

test('new touches invalidate old decay completion callbacks; canceled/reduced-motion pans never coast', () => {
  const h = harness();
  h.momentum();
  const animation = h.animations.at(-1);
  h.fire('doubleTap', 'onBegin');
  const stopped = h.options.viewport.get().start;
  animation.callback(true, -999);
  h.flush();
  near(h.options.viewport.get().start, stopped);
  assert.equal(animation.canceled, true);
  for (const [reducedMotion, canceled] of [[true, false], [false, true]]) {
    const safe = harness({ reducedMotion });
    safe.beginPan();
    safe.fire('pan', 'onDeactivate', { velocityX: 640, numberOfPointers: 0, canceled });
    assert.equal(safe.animations.length, 0);
    assert.equal(safe.options.interacting.get(), false);
  }
});

test('hold-and-drag inspection crosses the full plot without moving the viewport and releases on cancellation', () => {
  const h = harness();
  const original = h.options.viewport.get();
  h.fire('inspection', 'onBegin');
  assert.equal(h.options.interacting.get(), false, 'a possible hold must not claim the page scroll');
  h.fire('inspection', 'onActivate', { x: 20, y: 40 });
  h.fire('pan', 'onFinalize', { canceled: true });
  h.fire('inspection', 'onUpdate', { x: 300, y: 150 });
  assert.equal(h.options.crosshair.get().active, true);
  assert.equal(h.options.crosshair.get().x, 300);
  assert.equal(h.options.crosshair.get().y, 150);
  assert.equal(h.options.viewport.get(), original);
  assert.equal(h.options.interacting.get(), true);
  h.fire('inspection', 'onTouchesCancel');
  assert.equal(h.options.crosshair.get().active, false);
  assert.equal(h.options.interacting.get(), false);
});

test('double tap anchors zoom at the tap and clears inspection', () => {
  const h = harness();
  h.options.crosshair.set({ active: true, x: 88, y: 100 });
  const before = h.options.viewport.get();
  h.fire('doubleTap', 'onActivate', { x: 88 });
  const after = h.options.viewport.get();
  near(after.start + 0.25 * (after.count - 1), before.start + 0.25 * (before.count - 1));
  assert.equal(h.options.crosshair.get().active, false);
});

test('blur, background, disabled layout and unmount stop momentum and reject subsequent updates', () => {
  for (const stop of ['blur', 'background', 'unmount', 'disabled']) {
    const h = harness();
    h.momentum();
    if (stop === 'blur') h.focus(false);
    if (stop === 'background') h.app('background');
    if (stop === 'unmount') h.unmount();
    if (stop === 'disabled') h.render({ enabled: false });
    assert.equal(h.animations.at(-1).canceled, true, stop);
    assert.equal(h.options.interacting.get(), false, stop);
    assert.equal(h.options.crosshair.get().active, false, stop);
    assert.equal(h.find('pan').config.enabled.get(), false, stop);
    const before = h.options.viewport.get();
    h.fire('pan', 'onUpdate', { changeX: 200 });
    assert.equal(h.options.viewport.get(), before, stop);
    if (stop === 'unmount') assert.equal(h.listeners, 0);
  }
  assert.equal(harness({ plotWidth: 0 }).find('pan').config.enabled.get(), false);
});

test('forming-price ticks retain momentum, while changed history cancels stale bounds and clamps the viewport', () => {
  const h = harness();
  h.momentum();
  const animation = h.animations.at(-1);
  h.options.candles.set(h.options.candles.get().map(candle => ({ ...candle, close: 11.5 })));
  h.flush();
  assert.equal(animation.canceled, false);
  h.options.candles.set(h.options.candles.get().slice(295));
  h.flush();
  assert.equal(animation.canceled, true);
  assert.equal(h.options.viewport.get().start, 0);
  assert.equal(h.options.viewport.get().count, 5);
  assert.equal(h.options.interacting.get(), false);
});

test('a decay frame cannot overwrite controller timestamp preservation during a simultaneous history roll', () => {
  const h = harness();
  h.momentum();
  const preserved = { start: h.options.viewport.get().start - 1, count: 80 };
  h.options.viewport.set(preserved);
  h.options.candles.set(h.options.candles.get().map(candle => ({ ...candle, time: candle.time + 1 })));
  const animation = h.tick(110);
  assert.equal(animation.canceled, true);
  near(h.options.viewport.get().start, preserved.start);
  assert.equal(h.options.interacting.get(), false);
});

test('a decay completion cannot overwrite controller timestamp preservation during a simultaneous history roll', () => {
  const h = harness();
  h.momentum();
  const animation = h.animations.at(-1);
  const preserved = { start: h.options.viewport.get().start - 1, count: 80 };
  h.options.viewport.set(preserved);
  h.options.candles.set(h.options.candles.get().map(candle => ({ ...candle, time: candle.time + 1 })));
  animation.callback(true, 110);
  h.flush();
  near(h.options.viewport.get().start, preserved.start);
  assert.equal(h.options.interacting.get(), false);
});
