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
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  }, ...globals });
  return module.exports;
}
async function settle() { for (let i = 0; i < 16; i++) await Promise.resolve(); }

// Actual coordinator and policy; native API calls and React commit lifetimes are
// controlled here. A resolved lock request does not establish a measured device rotation.
function fixture({ platform = 'android', publicPage = false, includeScope = true, failing = false, holdLocks = false } = {}) {
  const records = new Map(), listeners = new Set(), locks = [], timers = new Map();
  let current, pending, timerSequence = 0, top = 'practice', version = 0, resets = 0, active = true;
  const lockCompletions = []; let nativeActive = 0, maxNativeActive = 0;
  let preferences = { loaded: true, rotation: 'auto', immersive: true };
  let scope = { startupCovered: true, setupComplete: true, onboardingPreviewActive: false };
  const globals = { setTimeout(callback) { const id = ++timerSequence; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  const react = {
    useRef(initial) { return (current.slots[current.cursor++] ??= { current: initial }); },
    useEffect(callback, deps) {
      const record = current, index = record.cursor++, before = record.slots[index];
      if (!before || deps.some((dep, i) => dep !== before.deps[i])) pending.push(() => {
        before?.cleanup?.(); record.slots[index] = { deps, cleanup: callback() };
      });
    },
    useSyncExternalStore(_subscribe, getSnapshot) { current.cursor++; return getSnapshot(); },
  };
  react.useLayoutEffect = react.useEffect;
  const policy = load('src/lib/orientationPolicy.ts', {}, globals);
  const api = load('src/components/OrientationCoordinator.tsx', {
    react,
    'expo-router': { useSegments: () => [top] },
    'react-native': { Platform: { OS: platform }, AppState: { currentState: 'active', addEventListener(_event, callback) { listeners.add(callback); return { remove() { listeners.delete(callback); } }; } } },
    'expo-screen-orientation': { OrientationLock: { DEFAULT: 0, PORTRAIT_UP: 3 }, lockAsync(lock) {
      locks.push(lock); nativeActive++; maxNativeActive = Math.max(maxNativeActive, nativeActive);
      if (holdLocks) return new Promise(resolve => lockCompletions.push(() => { nativeActive--; resolve(); }));
      nativeActive--; return failing ? Promise.reject(new Error('native internal detail')) : Promise.resolve();
    } },
    '../lib/orientationPolicy': policy,
    '../lib/session': { useSession: () => ({ accountDataVersion: version }) },
    '../lib/uiPreferences': { useUiPreferences: () => preferences, resetUiPreferencesForAccountChange() { resets++; } },
  }, globals);
  function run(name, callback) {
    if (!records.has(name)) records.set(name, { slots: [], cursor: 0 });
    current = records.get(name); current.cursor = 0; pending = [];
    const result = callback(); pending.forEach(effect => effect()); return result;
  }
  function render() {
    if (includeScope) run('scope', () => api.OrientationScope(scope));
    run('owner', () => api.OrientationCoordinator({ publicPage }));
  }
  render();
  return {
    locks, listeners, timers,
    get resets() { return resets; },
    get maxNativeActive() { return maxNativeActive; },
    render,
    async settle() { await settle(); },
    update(next) {
      if (next.scope) scope = { ...scope, ...next.scope };
      if (next.preferences) preferences = { ...preferences, ...next.preferences };
      if ('top' in next) top = next.top;
      if ('publicPage' in next) publicPage = next.publicPage;
      if ('version' in next) version = next.version;
      if ('failing' in next) failing = next.failing;
      render();
    },
    foreground(next) { active = next; listeners.forEach(listener => listener(active ? 'active' : 'background')); },
    status: () => run('status', () => api.useOrientationStatus()),
    retry: () => api.retryOrientation(),
    finishLock: () => lockCompletions.shift()(),
    unmount() { for (const record of records.values()) record.slots.forEach(slot => slot?.cleanup?.()); records.clear(); },
  };
}

test('actual coordinator retains startup/setup ownership and applies postsetup Auto or Portrait', async () => {
  const h = fixture(); await h.settle(); assert.deepEqual(h.locks, [3]);
  h.update({ scope: { startupCovered: false } }); await h.settle(); assert.deepEqual(h.locks, [3, 0]);
  h.update({ top: 'onboarding' }); await h.settle(); assert.equal(h.locks.at(-1), 3);
  h.update({ top: 'settings' }); await h.settle(); assert.equal(h.locks.at(-1), 0);
  h.update({ preferences: { rotation: 'portrait' } }); await h.settle(); assert.equal(h.locks.at(-1), 3);
  h.update({ preferences: { rotation: 'auto' }, scope: { onboardingPreviewActive: true } }); await h.settle(); assert.equal(h.locks.at(-1), 3);
  h.unmount(); assert.equal(h.listeners.size, 0); assert.equal(h.timers.size, 0);
});

test('an effect remount shares the old physical queue instead of racing its uncancelable native request', async () => {
  const h = fixture({ holdLocks: true });
  assert.deepEqual(h.locks, [3]); h.unmount(); assert.equal(h.timers.size, 0);
  h.update({ scope: { startupCovered: false } });
  assert.deepEqual(h.locks, [3], 'The remounted owner must wait for the original physical request');
  h.finishLock(); await h.settle(); assert.deepEqual(h.locks, [3, 0]);
  h.finishLock(); await h.settle();
  assert.equal(h.maxNativeActive, 1); assert.equal(h.status().applied, 'auto');
  h.unmount();
});

test('public routes apply an independent display policy and account reset invalidates UI preference memory', async () => {
  const h = fixture({ publicPage: true, includeScope: false }); await h.settle();
  assert.equal(h.locks.at(-1), 0, 'Public legal pages do not wait for setup scope');
  assert.equal(h.resets, 0);
  h.update({ version: 1 }); assert.equal(h.resets, 1);
  h.render(); assert.equal(h.resets, 1);
  h.update({ preferences: { loaded: false } }); await h.settle(); assert.equal(h.locks.at(-1), 3);
  h.unmount();
});

test('background changes wait for foreground, errors remain retryable, and web never calls native orientation', async () => {
  const h = fixture(); await h.settle();
  h.foreground(false); h.update({ scope: { startupCovered: false } }); await h.settle(); assert.deepEqual(h.locks, [3]);
  h.foreground(true); await h.settle(); assert.equal(h.locks.at(-1), 0);
  h.update({ failing: true, preferences: { rotation: 'portrait' } }); await h.settle();
  assert.match(h.status().error, /Rotation could not be updated/);
  h.update({ failing: false }); h.retry(); await h.settle(); assert.equal(h.status().error, '');
  h.unmount();
  const web = fixture({ platform: 'web' }); web.update({ scope: { startupCovered: false } }); await web.settle();
  assert.deepEqual(web.locks, []); assert.equal(web.listeners.size, 0); web.unmount();
});
