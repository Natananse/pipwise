const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  return module.exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === 'object' ? [node, ...nodes(node.props.children)] : [];
}

function fixture(platform = 'android') {
  const records = new Map(), listeners = new Set(), backgrounds = [];
  let current, effects, visited, dirty, tree;
  let focused = true, immersive = true, startup = false, modal = false;
  let snapshot = { active: true, enabled: true, hidden: true, fullScreen: false, blocked: false };
  const react = {
    Fragment: Symbol('Fragment'), createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useEffect(callback, deps) {
      const record = current, index = record.cursor++, previous = record.slots[index];
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) effects.push(() => {
        previous?.cleanup?.(); record.slots[index] = { deps, cleanup: callback() };
      });
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const record = current, index = record.cursor++;
      if (!record.slots[index]) record.slots[index] = { cleanup: subscribe(() => { dirty = true; }) };
      return getSnapshot();
    },
  };
  react.default = react;
  const bars = load('src/components/ScreenSystemBars.tsx', {
    react, 'expo-router': { useIsFocused: () => focused },
    'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-navigation-bar': { NavigationBar: 'NavigationBar' },
    'expo-system-ui': { setBackgroundColorAsync: async color => backgrounds.push(color) }, 'react-native': { Platform: { OS: platform } },
    '../lib/systemBarOverrides': load('src/lib/systemBarOverrides.ts'),
    '../lib/tradeChrome': { tradeChrome: { subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); }, getSnapshot: () => snapshot, getServerSnapshot: () => snapshot } },
  });
  function expand(node, path) {
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${path}.${index}`));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}`;
      if (!records.has(key)) records.set(key, { slots: [], cursor: 0 });
      const record = records.get(key), previous = current;
      current = record; current.cursor = 0; visited.add(key);
      const result = node.type(node.props); current = previous;
      return expand(result, `${key}.view`);
    }
    return { ...node, props: { ...node.props, children: expand(node.props.children, `${path}.children`) } };
  }
  function render() {
    for (let attempt = 0; attempt < 10; attempt++) {
      effects = []; visited = new Set(); dirty = false;
      tree = expand([
        react.createElement(bars.ScreenSystemBars, { style: 'dark', navigationStyle: 'dark', backgroundColor: '#F7F5EF', immersive }),
        startup && react.createElement(bars.StartupSystemBars, {}),
        modal && react.createElement(bars.ModalSystemBars, {}),
      ], 'root');
      for (const [key, record] of records) if (!visited.has(key)) {
        record.slots.forEach(slot => slot?.cleanup?.()); records.delete(key);
      }
      effects.forEach(effect => effect());
      if (!dirty) return;
    }
    assert.fail('System bar ownership did not settle');
  }
  render();
  return {
    backgrounds,
    statuses: () => nodes(tree).filter(node => node.type === 'StatusBar'),
    navigation: () => nodes(tree).filter(node => node.type === 'NavigationBar'),
    chrome(patch) { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); render(); },
    focus(next) { focused = next; render(); }, immersive(next) { immersive = next; render(); },
    startup(next) { startup = next; render(); }, modal(next) { modal = next; render(); },
    unmount() { records.forEach(record => record.slots.forEach(slot => slot?.cleanup?.())); records.clear(); },
    get chromeListeners() { return listeners.size; },
  };
}

test('actual immersive Trade bars hide only for active, enabled, unblocked hidden chrome', () => {
  const h = fixture();
  assert.equal(h.statuses()[0].props.hidden, true);
  assert.equal(h.navigation()[0].props.hidden, true);
  h.chrome({ blocked: true });
  assert.equal(h.statuses()[0].props.hidden, false);
  assert.equal(h.navigation()[0].props.hidden, false);
  h.chrome({ blocked: false, enabled: false }); assert.equal(h.statuses()[0].props.hidden, false);
  h.chrome({ enabled: true, active: false }); assert.equal(h.statuses()[0].props.hidden, false);
  h.chrome({ active: true, hidden: false }); assert.equal(h.statuses()[0].props.hidden, false);
  h.chrome({ hidden: true }); assert.equal(h.statuses()[0].props.hidden, true);
  h.immersive(false);
  assert.equal(h.statuses()[0].props.hidden, false, 'Another route ignores stale Trade chrome');
  assert.equal(h.navigation()[0].props.hidden, false);
});

test('startup and modal owners stay visible above hidden Trade, then release to its current state', () => {
  const h = fixture();
  h.startup(true);
  assert.equal(h.statuses().length, 1, 'Startup suppresses the underlying focused route');
  assert.equal(h.statuses()[0].props.hidden, false);
  assert.equal(h.statuses()[0].props.style, 'light');
  assert.equal(h.navigation()[0].props.hidden, false);
  assert.equal(h.backgrounds.at(-1), '#0D1011');
  h.startup(false);
  assert.equal(h.statuses()[0].props.hidden, true);
  const beforeModal = h.backgrounds.length;
  h.modal(true);
  assert.equal(h.statuses().at(-1).props.hidden, false);
  assert.equal(h.navigation().at(-1).props.hidden, false);
  assert.equal(h.navigation().at(-1).props.style, 'dark');
  assert.equal(h.backgrounds.length, beforeModal, 'Modal icon ownership must not repaint the route window');
  h.modal(false);
  assert.equal(h.statuses().length, 1);
  assert.equal(h.statuses()[0].props.hidden, true);
});

test('blur removes bar ownership and background writes; unmount removes chrome listeners', () => {
  const h = fixture();
  const before = h.backgrounds.length;
  assert.equal(h.chromeListeners, 1);
  h.focus(false);
  assert.equal(h.statuses().length, 0);
  assert.equal(h.navigation().length, 0);
  assert.equal(h.backgrounds.length, before);
  assert.equal(h.chromeListeners, 0);
  h.focus(true);
  assert.equal(h.statuses()[0].props.hidden, true);
  h.unmount(); assert.equal(h.chromeListeners, 0);
  const web = fixture('web');
  assert.equal(web.navigation().length, 0);
  assert.equal(web.backgrounds.length, 0);
});
