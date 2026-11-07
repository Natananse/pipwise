const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports, globals) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText,
    { module, exports: module.exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return module.exports;
}
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  return node && typeof node === 'object' ? [node, ...all(node.props.children)] : [];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
}

// Actual guard components with measured-window changes and React lifetimes.
// This proves when children mount/remain mounted; native pixels and lock delivery need a phone.
function fixture({ startup = false, platform = 'android', width = 844, height = 390 } = {}) {
  const records = new Map(), timers = new Map();
  let current, tree, visited, pending, dirty, now = 0, sequence = 0, mounted = true;
  let dimensions = { width, height }, required = true, starts = 0, stops = 0, setDraft;
  const clock = { setTimeout(callback, ms) { const id = ++sequence; timers.set(id, { callback, due: now + ms }); return id; }, clearTimeout(id) { timers.delete(id); } };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef(initial) { return (current.slots[current.cursor++] ??= { current: initial }); },
    useMemo(callback, deps) {
      const index = current.cursor++, before = current.slots[index];
      if (!before || deps.some((dep, i) => dep !== before.deps[i])) current.slots[index] = { value: callback(), deps };
      return current.slots[index].value;
    },
    useState(initial) {
      const record = current, index = record.cursor++;
      if (!(index in record.slots)) record.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [record.slots[index].value, next => {
        const before = record.slots[index].value;
        record.slots[index].value = typeof next === 'function' ? next(before) : next;
        dirty ||= before !== record.slots[index].value;
      }];
    },
    useEffect(callback, deps) {
      const record = current, index = record.cursor++, before = record.slots[index];
      if (!before || deps.some((dep, i) => dep !== before.deps[i])) pending.push(() => {
        before?.cleanup?.(); record.slots[index] = { deps, cleanup: callback() };
      });
    },
    useSyncExternalStore(_subscribe, snapshot) { current.cursor++; return snapshot(); },
  };
  react.default = react; react.useLayoutEffect = react.useEffect;
  const policy = load('src/lib/orientationPolicy.ts', {}, clock);
  const guards = load('src/components/OrientationCoordinator.tsx', {
    react, 'expo-router': { useSegments: () => ['onboarding'] },
    'react-native': { Platform: { OS: platform }, useWindowDimensions: () => dimensions,
      ...Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'ActivityIndicator'].map(name => [name, name])) },
    'expo-screen-orientation': {}, '../lib/orientationPolicy': policy,
    '../lib/session': { useSession: () => ({ accountDataVersion: 0 }) },
    '../lib/uiPreferences': { useUiPreferences: () => ({ loaded: true, rotation: 'auto' }), resetUiPreferencesForAccountChange() {} },
  }, clock);
  function Probe() {
    const [draft, update] = react.useState('saved draft'); setDraft = update;
    react.useEffect(() => { starts++; return () => { stops++; }; }, []);
    return react.createElement('Probe', { draft }, draft);
  }
  function expand(node, path) {
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${path}.${index}`));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const id = `${path}:${node.type.name}`;
      if (!records.has(id)) records.set(id, { slots: [], cursor: 0 });
      const parent = current; current = records.get(id); current.cursor = 0; visited.add(id);
      const result = node.type(node.props); current = parent;
      return expand(result, `${id}.view`);
    }
    return { ...node, props: { ...node.props, children: expand(node.props.children, `${path}.children`) } };
  }
  function render() {
    if (!mounted) return;
    for (let attempt = 0; attempt < 12; attempt++) {
      dirty = false; visited = new Set(); pending = [];
      tree = expand(react.createElement(startup ? guards.PortraitStartupGate : guards.PortraitRouteGuard,
        { required }, react.createElement(Probe, {})), 'root');
      for (const [id, record] of records) if (!visited.has(id)) { record.slots.forEach(slot => slot?.cleanup?.()); records.delete(id); }
      pending.forEach(effect => effect());
      if (!dirty) return;
    }
    throw new Error('Unexpected presentation render loop');
  }
  render();
  return {
    get starts() { return starts; }, get stops() { return stops; }, get timerCount() { return timers.size; },
    all: () => all(tree), text: () => text(tree), node: type => all(tree).find(node => node.type === type),
    window(width, height) { dimensions = { width, height }; render(); },
    required(value) { required = value; render(); },
    draft(value) { setDraft(value); render(); },
    advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); } render(); },
    retry() { const control = all(tree).find(node => node.props.accessibilityLabel === 'Retry portrait display'); assert.ok(control); control.props.onPress(); render(); },
    unmount() { mounted = false; for (const record of records.values()) record.slots.forEach(slot => slot?.cleanup?.()); records.clear(); },
  };
}

test('a delayed portrait window cannot start the welcome hidden or consume its visible animation time', () => {
  const h = fixture({ startup: true });
  assert.equal(h.starts, 0); assert.equal(h.node('Probe'), undefined);
  assert.equal(h.node('View').props.style.backgroundColor, '#0D1011');
  h.advance(9999); assert.equal(h.starts, 0);
  h.advance(1); assert.match(h.text(), /Turn your device upright/);
  assert.ok(h.node('ScrollView'), 'Failure guidance remains scrollable with large text');
  h.retry(); assert.match(h.text(), /Preparing portrait display/); assert.equal(h.timerCount, 1);
  h.window(390, 844); assert.equal(h.starts, 1); assert.ok(h.node('Probe')); assert.equal(h.timerCount, 0);
  h.advance(20000); assert.equal(h.starts, 1);
  h.unmount();
});

test('a forced resize stops the welcome instead of allowing an invisible animation to finish', () => {
  const h = fixture({ startup: true, width: 390, height: 844 });
  assert.equal(h.starts, 1);
  h.window(844, 390); assert.equal(h.stops, 1); assert.equal(h.node('Probe'), undefined);
  h.advance(1000); assert.equal(h.starts, 1);
  h.window(390, 844); assert.equal(h.starts, 2, 'A new visible welcome starts from its original beginning');
  h.unmount();
});

test('landscape concealment and retries keep the mounted wizard and its current draft alive', () => {
  const h = fixture();
  assert.equal(h.starts, 1); h.draft('unsaved question selection');
  const hidden = h.all().find(node => node.props.importantForAccessibility === 'no-hide-descendants');
  assert.equal(hidden.props.pointerEvents, 'none'); assert.equal(hidden.props.style.display, 'none');
  assert.equal(hidden.props['aria-hidden'], true);
  h.advance(10000); h.retry();
  assert.equal(h.starts, 1); assert.equal(h.stops, 0);
  h.window(390, 844);
  assert.equal(h.node('Probe').props.draft, 'unsaved question selection');
  const revealed = h.all().find(node => node.props.importantForAccessibility === 'auto');
  assert.equal(revealed.props.pointerEvents, 'auto'); assert.equal(revealed.props.style.display, 'flex');
  h.window(844, 390); h.advance(10000);
  assert.equal(h.starts, 1); assert.equal(h.node('Probe').props.draft, 'unsaved question selection');
  h.required(false); assert.equal(h.timerCount, 0); assert.equal(h.starts, 1);
  h.unmount(); assert.equal(h.stops, 1);
});

test('unknown native dimensions wait, web remains responsive, and cleanup removes pending deadlines', () => {
  const h = fixture({ startup: true, width: 0, height: 0 });
  assert.equal(h.starts, 0); assert.equal(h.timerCount, 1); h.unmount(); assert.equal(h.timerCount, 0);
  const web = fixture({ startup: true, platform: 'web' });
  assert.equal(web.starts, 1); assert.equal(web.timerCount, 0); web.unmount();
});
