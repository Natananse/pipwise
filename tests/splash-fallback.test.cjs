const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function fakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(duration, flush) {
      const target = now + duration;
      for (let count = 0; ; count++) {
        assert.ok(count < 100, 'timers must settle');
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        flush();
      }
      now = target;
    },
    get pending() { return timers.size; },
  };
}

// Preserve hook slots and effect cleanup across rerenders, without mounting a UI.
function hookHarness() {
  const slots = [];
  let index = 0;
  let mounted = false;
  let dirty = false;
  let render;
  let props;
  let effects = [];
  let value;
  const react = {
    createElement: () => null,
    useState(initial) {
      const slotIndex = index++;
      const slot = slots[slotIndex] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, next => {
        if (!mounted) return;
        const nextValue = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(nextValue, slot.value)) { slot.value = nextValue; dirty = true; }
      }];
    },
    useRef(initial) {
      const slotIndex = index++;
      return slots[slotIndex] ||= { current: initial };
    },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
    useEffect(effect, dependencies) {
      const slotIndex = index++;
      const previous = slots[slotIndex];
      const changed = !previous || !dependencies || dependencies.some((dependency, i) => !Object.is(dependency, previous.dependencies[i]));
      if (changed) {
        const slot = { dependencies, cleanup: previous?.cleanup };
        slots[slotIndex] = slot;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const harness = {
    react: { ...react, default: react },
    mount(component, initialProps) {
      render = component;
      props = initialProps;
      mounted = true;
      dirty = true;
      harness.flush();
    },
    update(nextProps) { props = nextProps; dirty = true; harness.flush(); },
    flush() {
      for (let count = 0; mounted && dirty; count++) {
        assert.ok(count < 25, 'hook updates must settle');
        dirty = false;
        index = 0;
        effects = [];
        value = render(props);
        const pending = effects;
        effects = [];
        for (const effect of pending) effect();
      }
    },
    unmount() {
      mounted = false;
      for (const slot of slots) slot.cleanup?.();
    },
    get value() { return value; },
  };
  return harness;
}

function load(file, imports, clock) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    require(name) {
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}

function nativeAnimations() {
  const started = [];
  const animation = () => ({
    stopped: false,
    start(callback) { this.callback = callback; started.push(this); },
    stop() { this.stopped = true; this.callback?.({ finished: false }); },
    finish() { if (!this.stopped) this.callback?.({ finished: true }); },
  });
  return {
    started,
    Animated: {
      Value: class {
        constructor(value) { this.value = value; }
        setValue(value) { this.value = value; }
        interpolate() { return this.value; }
      },
      View: 'Animated.View',
      timing: animation, sequence: animation, parallel: animation, delay: animation, stagger: animation,
    },
  };
}

function splash({ reducedMotion = false, resourcesReady = true, pendingPreference = false } = {}) {
  const clock = fakeClock();
  const harness = hookHarness();
  const animations = nativeAnimations();
  let completions = 0;
  const native = {
    Animated: animations.Animated,
    Easing: { out: value => value, inOut: value => value, cubic: null, quad: null },
    Platform: { OS: 'android' },
    StyleSheet: { create: value => value, absoluteFill: {} },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    AccessibilityInfo: {
      isReduceMotionEnabled: () => new Promise(() => {}),
      addEventListener: () => ({ remove() {} }),
    },
  };
  const preference = pendingPreference
    ? load('src/lib/useReducedMotion.ts', { react: harness.react, 'react-native': native }, clock)
    : { useReducedMotion: () => reducedMotion };
  const { LaunchSplash } = load('src/components/LaunchSplash.tsx', {
    react: harness.react,
    'react-native': native,
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-svg': { default: 'Svg', Circle: 'Circle', Line: 'Line', Path: 'Path' },
    '../lib/onboarding': { onboardingText: (_language, text) => text },
    '../lib/theme': { fonts: { extraBold: 'test-font' } },
    '../lib/useReducedMotion': preference,
    './AppLogo': { AppLogo: 'AppLogo' },
    './design': { Label: 'Label' },
  }, clock);
  const props = { fontsReady: true, resourcesReady, language: 'en', onComplete: () => { completions++; } };
  harness.mount(LaunchSplash, props);
  return {
    clock, harness, animations,
    advance: duration => clock.advance(duration, harness.flush),
    ready: () => harness.update({ ...props, resourcesReady: true }),
    get completions() { return completions; },
  };
}

test('an unanswered native accessibility query releases its initial wait', () => {
  const clock = fakeClock();
  const harness = hookHarness();
  let removed = false;
  const { useReducedMotion } = load('src/lib/useReducedMotion.ts', {
    react: harness.react,
    'react-native': { AccessibilityInfo: {
      isReduceMotionEnabled: () => new Promise(() => {}),
      addEventListener: () => ({ remove() { removed = true; } }),
    } },
  }, clock);
  harness.mount(useReducedMotion);
  assert.equal(harness.value, null);
  clock.advance(999, harness.flush);
  assert.equal(harness.value, null);
  clock.advance(1, harness.flush);
  assert.equal(harness.value, true);
  harness.unmount();
  assert.equal(removed, true);
  assert.equal(clock.pending, 0);
});

test('silent native animations still release a ready splash exactly once', () => {
  const fixture = splash();
  fixture.advance(2199);
  assert.equal(fixture.completions, 0);
  fixture.advance(401);
  assert.equal(fixture.completions, 1);
  for (const animation of fixture.animations.started) animation.finish();
  fixture.advance(10000);
  assert.equal(fixture.completions, 1);
  fixture.harness.unmount();
});

test('finishing the intro cannot release a splash before resources are ready', () => {
  const fixture = splash({ resourcesReady: false });
  fixture.advance(10000);
  assert.equal(fixture.completions, 0);
  fixture.ready();
  fixture.advance(399);
  assert.equal(fixture.completions, 0);
  fixture.advance(1);
  assert.equal(fixture.completions, 1);
  fixture.harness.unmount();
});

test('unmount cancels both intro and exit fallback completion', () => {
  for (const phase of ['intro', 'exit']) {
    const fixture = splash();
    if (phase === 'exit') fixture.advance(2200);
    fixture.harness.unmount();
    assert.equal(fixture.clock.pending, 0, `${phase} timer must be cleared`);
    assert.ok(fixture.animations.started.every(animation => animation.stopped));
    fixture.advance(10000);
    assert.equal(fixture.completions, 0, `${phase} must not complete after unmount`);
  }
});

test('an unanswered preference query and silent animations cannot strand reduced-motion startup', () => {
  const fixture = splash({ pendingPreference: true });
  fixture.advance(999);
  assert.equal(fixture.completions, 0);
  fixture.advance(101);
  assert.equal(fixture.completions, 1);
  fixture.harness.unmount();
  assert.equal(fixture.clock.pending, 0);
});

test('splash geometry matches SSR and initial hydration before adopting measured dimensions', () => {
  function geometry(width, height, hydrated) {
    const clock = fakeClock();
    const harness = hookHarness();
    const elements = [];
    const createElement = (type, props, ...children) => {
      const element = { type, props, children };
      elements.push(element);
      return element;
    };
    harness.react.createElement = harness.react.default.createElement = createElement;
    harness.react.useSyncExternalStore = harness.react.default.useSyncExternalStore = () => hydrated;
    const animations = nativeAnimations();
    const { LaunchSplash } = load('src/components/LaunchSplash.tsx', {
      react: harness.react,
      'react-native': { Animated: animations.Animated, Easing: {}, Platform: { OS: 'web' }, StyleSheet: { create: value => value, absoluteFill: {} }, View: 'View', useWindowDimensions: () => ({ width, height }) },
      'expo-status-bar': { StatusBar: 'StatusBar' },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'react-native-svg': { default: 'Svg', Circle: 'Circle', Line: 'Line', Path: 'Path' },
      '../lib/onboarding': { onboardingText: (_language, value) => value },
      '../lib/theme': { fonts: { extraBold: 'test-font' } },
      '../lib/useReducedMotion': { useReducedMotion: () => null },
      './AppLogo': { AppLogo: 'AppLogo' }, './design': { Label: 'Label' },
    }, clock);
    harness.mount(LaunchSplash, { fontsReady: false, resourcesReady: false, language: 'en', onComplete() {} });
    const frame = elements.find(element => element.type === 'View' && element.props?.['aria-hidden']);
    const artwork = elements.find(element => element.type === 'View' && element.props?.style?.position === 'absolute' && element.props.style.width === 280);
    const wordmark = elements.find(element => element.type === 'Label' && element.children[0] === 'Pipwise');
    harness.unmount();
    return { size: frame.props.style.width, left: artwork.props.style.left, top: artwork.props.style.top, scale: artwork.props.style.transform[0].scale, wordmark: wordmark.props.size };
  }
  const server = geometry(0, 0, false);
  assert.deepEqual(server, { size: 280, left: 0, top: 0, scale: 1, wordmark: 50 });
  assert.deepEqual(geometry(320, 640, false), server, 'the first browser render must match zero-dimension SSR');
  assert.deepEqual(geometry(320, 640, true), { size: 236, left: -22, top: -22, scale: 236 / 280, wordmark: 44 });
  assert.deepEqual(geometry(390, 844, true), server, 'native uses its measured dimensions immediately');
  assert.deepEqual(geometry(0, 0, true), server, 'an unmeasured window must not generate negative artwork geometry');
});
