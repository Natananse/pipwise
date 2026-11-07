const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  return module.exports;
}

function fixture({ platform = 'android', width = 390, height = 844 } = {}) {
  const slots = [], listeners = new Map();
  let cursor = 0, dirty = false, pending = [], result, registrations = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const previous = slots[index].value;
        slots[index].value = typeof next === 'function' ? next(previous) : next;
        dirty ||= previous !== slots[index].value;
      }];
    },
    useEffect(callback, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) pending.push(() => {
        previous?.cleanup?.(); slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  const hook = load('src/lib/useTradingWindow.ts', {
    react, './tradingLayout': load('src/lib/tradingLayout.ts'),
    'react-native': {
      Platform: { OS: platform }, useWindowDimensions: () => ({ width, height, fontScale: 1, scale: 3 }),
      Keyboard: { isVisible: () => false, addListener(name, callback) {
        registrations++;
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(callback);
        return { remove: () => listeners.get(name).delete(callback) };
      } },
    },
  });
  function render() {
    for (let attempt = 0; attempt < 10; attempt++) {
      cursor = 0; dirty = false; pending = [];
      result = hook.useTradingWindow();
      // React repeats a render-phase state adjustment before committing effects.
      if (dirty) continue;
      pending.forEach(effect => effect());
      if (!dirty) return result;
    }
    assert.fail('Trading window state did not settle');
  }
  render();
  return {
    get value() { return result; }, get registrations() { return registrations; },
    get listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
    resize(nextWidth, nextHeight) { width = nextWidth; height = nextHeight; render(); },
    focus() { result.onInputFocus(); render(); }, blur() { result.onInputBlur(); render(); },
    emit(name) { for (const callback of listeners.get(name) || []) callback(); render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('actual Android hook holds portrait before the IME event and tracks rotation with the keyboard open', () => {
  const h = fixture();
  assert.equal(h.value.landscape, false);
  h.focus();
  h.resize(390, 270);
  assert.equal(h.value.keyboardVisible, false, 'Input focus precedes the native show event');
  assert.equal(h.value.landscape, false, 'An IME-reduced height is not device rotation');
  h.emit('keyboardDidShow');
  assert.equal(h.value.keyboardVisible, true);
  h.resize(844, 180);
  assert.equal(h.value.landscape, true);
  h.resize(390, 270);
  assert.equal(h.value.landscape, false);
  h.blur();
  assert.equal(h.value.landscape, false, 'The visible keyboard remains an editing owner after blur');
  h.resize(390, 844); h.emit('keyboardDidHide');
  assert.equal(h.value.keyboardVisible, false);
  assert.equal(h.value.height, 844);
  h.resize(844, 390);
  assert.equal(h.value.landscape, true, 'After hide the hook follows the live window again');
  assert.equal(h.registrations, 2, 'Resizes must not accumulate listeners');
});

test('a landscape-starting hook rotates to portrait and back during editing, then refreshes its full-window baseline', () => {
  const h = fixture({ width: 844, height: 390 });
  h.focus(); h.resize(844, 160); h.emit('keyboardDidShow');
  assert.equal(h.value.landscape, true);
  h.resize(390, 260); assert.equal(h.value.landscape, false);
  h.resize(844, 160); assert.equal(h.value.landscape, true);
  h.resize(390, 844); h.emit('keyboardDidHide');
  assert.equal(h.value.landscape, false);
  h.focus(); h.resize(390, 260);
  assert.equal(h.value.landscape, false, 'A later portrait edit uses the newly restored portrait baseline');
});

test('native keyboard subscriptions use platform timing and clean up; web registers none', () => {
  for (const platform of ['android', 'ios', 'web']) {
    const h = fixture({ platform });
    assert.equal(h.listenerCount, platform === 'web' ? 0 : 2);
    if (platform !== 'web') {
      h.emit(platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow');
      assert.equal(h.value.keyboardVisible, true);
      h.emit(platform === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide');
      assert.equal(h.value.keyboardVisible, false);
    }
    h.unmount();
    assert.equal(h.listenerCount, 0);
  }
});
