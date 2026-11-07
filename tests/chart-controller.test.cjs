const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return module.exports;
}

function series(start = 0, length = 120) {
  return Array.from({ length }, (_, i) => ({ time: (start + i) * 60000, open: 100, high: 102, low: 99, close: 101 }));
}

// This models thread scheduling and hook lifetime, not native recognizers or frame timing.
function fixture(initial = {}) {
  const slots = [], uiJobs = [], rnJobs = [];
  let cursor = 0, pending = [], dirty = true, value, ui = false, mounted = true, publications = 0;
  let props = { candles: series(), identity: 'EUR/USD:1m', initialCount: 36, ...initial };
  const dependenciesChanged = (old, deps) => !old || deps.some((dep, i) => dep !== old.deps[i]);
  const react = {
    useState(initialValue) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initialValue === 'function' ? initialValue() : initialValue };
      return [slots[index].value, next => {
        const before = slots[index].value;
        slots[index].value = typeof next === 'function' ? next(before) : next;
        dirty ||= before !== slots[index].value;
      }];
    },
    useMemo(callback, deps) {
      const index = cursor++;
      if (dependenciesChanged(slots[index], deps)) slots[index] = { value: callback(), deps };
      return slots[index].value;
    },
    useRef(initialValue) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initialValue };
      return slots[index];
    },
    useEffect(callback, deps) {
      const index = cursor++, previous = slots[index];
      if (dependenciesChanged(previous, deps)) pending.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  function onUI(callback) {
    const before = ui; ui = true;
    try { return callback(); } finally { ui = before; }
  }
  const reanimated = {
    useSharedValue(initialValue) {
      const index = cursor++;
      if (!slots[index]) {
        let saved = initialValue;
        slots[index] = { get value() {
          assert.ok(ui, 'Live shared values must not be read on the React/JS runtime');
          return saved;
        }, set value(next) {
          assert.ok(ui, 'Controller changes must be scheduled on the UI runtime');
          saved = next;
        } };
      }
      return slots[index];
    },
    useAnimatedReaction(prepare, reactToChange) {
      const index = cursor++;
      slots[index] = { ...slots[index], reaction: { prepare, reactToChange } };
    },
  };
  const math = load('src/lib/chartViewport.ts');
  const { useChartController } = load('src/components/useChartController.ts', {
    react, 'react-native-reanimated': reanimated,
    'react-native-worklets': {
      scheduleOnUI(callback, ...args) { uiJobs.push(() => callback(...args)); },
      scheduleOnRN(callback, ...args) { publications++; rnJobs.push(() => callback(...args)); },
    }, '../lib/chartViewport': math,
  });
  function flush() {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (dirty && mounted) {
        dirty = false; cursor = 0; pending = [];
        value = useChartController(props);
        pending.forEach(effect => effect());
      }
      while (uiJobs.length) onUI(uiJobs.shift());
      if (mounted) onUI(() => {
        for (const slot of slots) if (slot?.reaction) {
          const next = slot.reaction.prepare();
          slot.reaction.reactToChange(next, slot.previous ?? null);
          slot.previous = next;
        }
      });
      while (rnJobs.length) rnJobs.shift()();
      if (!dirty && !uiJobs.length && !rnJobs.length) return;
    }
    throw new Error('Unexpected controller render loop');
  }
  flush();
  return {
    get value() { return value; }, get publications() { return publications; },
    read: () => onUI(() => ({ viewport: { ...value.viewport.value }, candles: value.candles.value, crosshair: { ...value.crosshair.value }, interacting: value.interacting.value })),
    write(callback) { onUI(() => callback(value)); flush(); },
    update(next) { props = { ...props, ...next }; dirty = true; flush(); },
    invoke(name) { value[name](); flush(); },
    flush,
    unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('tools use the live UI viewport and keep zoom anchored in historical data', () => {
  const h = fixture();
  assert.equal(h.read().viewport.start, 84);
  h.invoke('panEarlier');
  assert.equal(h.read().viewport.start, 75);
  h.invoke('zoomIn');
  const zoomed = h.read().viewport;
  assert.ok(zoomed.count < 36);
  assert.equal(zoomed.start + (zoomed.count - 1) / 2, 75 + 35 / 2);
  h.value.panEarlier(); h.value.panEarlier(); h.flush();
  assert.ok(Math.abs(h.read().viewport.start - (zoomed.start - zoomed.count / 2)) < 1e-9);
  const center = h.read().viewport.start + (h.read().viewport.count - 1) / 2;
  h.invoke('zoomOut');
  assert.ok(Math.abs(h.read().viewport.start + (h.read().viewport.count - 1) / 2 - center) < 1e-9);
  h.invoke('reset');
  assert.equal(h.read().viewport.start, 84);
});

test('new bars follow the latest edge only while the user is not interacting', () => {
  const h = fixture();
  h.update({ candles: series(0, 121) });
  assert.equal(h.read().viewport.start, 85);
  h.write(value => { value.interacting.value = true; });
  h.update({ candles: series(0, 122) });
  assert.equal(h.read().viewport.start, 85);
  h.write(value => { value.interacting.value = false; });
  h.update({ candles: series(0, 123) });
  assert.equal(h.read().viewport.start, 85, 'Historical inspection must not jump to the latest bar');
});

test('a rolling history preserves the fractional timestamp anchor and clamps removed history', () => {
  const h = fixture();
  h.write(value => { value.viewport.value = { start: 65.25, count: 36 }; });
  h.update({ candles: series(1, 120) });
  assert.equal(h.read().viewport.start, 64.25);
  h.update({ candles: series(100, 20) });
  assert.equal(h.read().viewport.start, 0);
  assert.equal(h.read().viewport.count, 20);
});

test('identity change resets viewport and inspection, and empty data stays safe', () => {
  const h = fixture();
  h.write(value => {
    value.viewport.value = { start: 10, count: 12 };
    value.crosshair.value = { active: true, x: 10, y: 20 };
    value.interacting.value = true;
  });
  h.update({ identity: 'BTC/USD:1m', candles: series(500, 90) });
  assert.equal(h.read().viewport.start, 54);
  assert.equal(h.read().viewport.count, 36);
  assert.equal(h.read().crosshair.active, false);
  assert.equal(h.read().interacting, false);
  h.update({ candles: [] });
  for (const control of Object.values(h.value.controls)) assert.equal(control, false);
  for (const name of ['zoomIn', 'zoomOut', 'panEarlier', 'panLater', 'reset']) h.invoke(name);
  assert.equal(h.read().viewport.start, 0);
  h.update({ candles: series(500, 30) });
  assert.equal(h.read().viewport.count, 30);
});

test('gesture motion publishes controls only when a boundary flag changes', () => {
  const h = fixture();
  h.write(value => { value.viewport.value = { start: 10, count: 36 }; });
  const before = h.publications;
  for (let i = 11; i < 40; i++) h.write(value => { value.viewport.value = { start: i, count: 36 }; });
  assert.equal(h.publications, before);
  h.write(value => { value.viewport.value = { start: 0, count: 36 }; });
  assert.equal(h.publications, before + 1);
  assert.equal(h.value.controls.canEarlier, false);
});
