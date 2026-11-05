const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText,
    { module, exports: module.exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return module.exports;
}
function fixture({ read = () => Promise.resolve(null), workspaceRead = () => Promise.resolve(null), write = async () => {} } = {}) {
  let clock = Date.UTC(2026, 10, 5, 12);
  class Clock extends Date { static now() { return clock; } }
  const intervals = new Map(), timeouts = new Map(), listeners = new Set(), writes = [];
  let sequence = 0, focused = true, mounted = true, dirty = true, pending = [], current, value, contextValue;
  const records = new Map();
  const react = {
    createContext(initial) { const context = { value: initial }; context.Provider = { context }; return context; },
    createElement(type, props) { if (type.context) type.context.value = props.value; return { type, props }; },
    useContext(context) { return context.value; },
    useState(initial) {
      const slot = current.cursor++, record = current;
      if (!(slot in record.slots)) record.slots[slot] = { value: typeof initial === 'function' ? initial() : initial };
      return [record.slots[slot].value, next => {
        const old = record.slots[slot].value;
        record.slots[slot].value = typeof next === 'function' ? next(old) : next;
        dirty ||= old !== record.slots[slot].value;
      }];
    },
    useMemo(callback, deps) {
      const slot = current.cursor++;
      const old = current.slots[slot];
      if (!old || deps.some((dep, i) => dep !== old.deps[i])) current.slots[slot] = { deps, value: callback() };
      return current.slots[slot].value;
    },
    useEffect(callback, deps) {
      const slot = current.cursor++, record = current, old = record.slots[slot];
      if (!old || deps.some((dep, i) => dep !== old.deps[i])) pending.push(() => {
        old?.cleanup?.(); record.slots[slot] = { deps, cleanup: callback() };
      });
    },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  react.default = react;
  const globals = { Date: Clock, setTimeout: (cb, ms) => { const id = ++sequence; timeouts.set(id, { cb, ms }); return id; }, clearTimeout: id => timeouts.delete(id),
    setInterval: (cb, ms) => { const id = ++sequence; intervals.set(id, { cb, ms }); return id; }, clearInterval: id => intervals.delete(id) };
  const market = load('src/lib/market.ts', {}, globals);
  const types = load('src/lib/marketTypes.ts', {}, globals);
  const engine = load('src/lib/demoMarket.ts', { './market': market, './marketTypes': types }, globals);
  const storage = { getItem: key => key === 'pipwise-moving-demo-v1' ? read(key) : workspaceRead(key),
    async setItem(key, saved) { await write(key, saved); writes.push({ key, value: JSON.parse(saved) }); } };
  const provider = load('src/lib/demoMarketProvider.tsx', {
    react, 'react-native': { AppState: { currentState: 'active', addEventListener(_event, callback) { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } } },
    'expo-router': { useFocusEffect: callback => react.useEffect(() => focused ? callback() : undefined, [focused, callback]) },
    '@react-native-async-storage/async-storage': storage, './demoMarket': engine,
    './persistence': load('src/lib/persistence.ts', {}, globals), './startupTasks': load('src/lib/startupTasks.ts', {}, globals),
  }, globals);
  function renderComponent(id, callback) {
    if (!records.has(id)) records.set(id, { slots: [], cursor: 0 });
    current = records.get(id); current.cursor = 0; return callback();
  }
  function render() {
    if (!mounted) return;
    for (let count = 0; count < 20; count++) {
      dirty = false; pending = [];
      contextValue = renderComponent('provider', () => provider.DemoMarketProvider({ children: null })).props.value;
      value = renderComponent('screen', () => provider.useDemoMarket({ active: true }));
      pending.forEach(effect => effect());
      if (!dirty) return;
    }
    throw new Error('Unexpected render loop');
  }
  render();
  return {
    render, writes, intervals, timeouts, engine, persist: provider.persistDemoMarket,
    get value() { return value; }, get context() { return contextValue; },
    async settle() { for (let i = 0; i < 16; i++) { await Promise.resolve(); render(); } },
    tick() { clock += 1000; for (const timer of [...intervals.values()]) if (timer.ms === 1000) timer.cb(); render(); },
    focus(next) { focused = next; render(); },
    state(next) { for (const listener of listeners) listener(next); render(); },
    timeout() { for (const timer of [...timeouts.values()]) timer.cb(); timeouts.clear(); render(); },
    unmount() { mounted = false; for (const record of records.values()) record.slots.forEach(slot => slot?.cleanup?.()); records.clear(); },
  };
}

test('clock waits for hydration and stops offscreen, in background and during manual pause', async () => {
  let resolve;
  const h = fixture({ read: () => new Promise(done => { resolve = done; }) });
  assert.equal(h.value.ready, false);
  assert.equal(h.intervals.size, 0);
  resolve(null); await h.settle();
  assert.equal(h.value.ready, true);
  assert.equal(h.intervals.size, 2);
  const quote = () => h.value.market.getQuote('EUR/USD').price;
  const original = quote(); h.tick(); assert.notEqual(quote(), original);
  h.focus(false); const away = quote(); h.tick(); assert.equal(quote(), away); assert.equal(h.intervals.size, 0);
  h.focus(true); h.state('background'); const background = quote(); h.tick(); assert.equal(quote(), background);
  h.state('active'); h.value.setPaused(true); h.render(); const paused = quote(); h.tick(); assert.equal(quote(), paused);
  h.value.setPaused(false); h.render(); h.tick(); assert.notEqual(quote(), paused);
  h.unmount(); await h.settle(); assert.equal(h.intervals.size, 0);
});

test('corrupt saved anchors are preserved and block trading until recovery succeeds', async () => {
  let saved = '{"version":1,"asOf":0}';
  const h = fixture({ read: () => Promise.resolve(saved) });
  await h.settle();
  assert.equal(h.value.ready, false);
  assert.match(h.context.initializationError, /restore saved demo prices/);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.writes.length, 0);
  saved = JSON.stringify(h.engine.demoMarket.serialize());
  h.context.retryInitialization(); h.render(); await h.settle();
  assert.equal(h.value.ready, true);
  assert.equal(h.context.initializationError, '');
  h.unmount();
});

test('a stalled read times out without resetting or overwriting prices', async () => {
  const h = fixture({ read: () => new Promise(() => {}) });
  h.timeout(); await h.settle();
  assert.equal(h.value.ready, false);
  assert.ok(h.context.initializationError);
  assert.equal(h.writes.length, 0);
  assert.equal(h.intervals.size, 0);
  h.unmount();
});

test('missing saved marks block an existing moving wallet without writing new baseline prices', async () => {
  const wallet = { cash: 9000, positions: [{ symbol: 'EUR/USD', pricingSource: 'moving-demo-v1' }], history: [] };
  const h = fixture({ workspaceRead: () => Promise.resolve(JSON.stringify({ wallet })) });
  await h.settle();
  assert.equal(h.value.ready, false);
  assert.match(h.context.initializationError, /prices are missing/);
  assert.equal(h.writes.length, 0);
  assert.equal(h.intervals.size, 0);
  h.unmount();
});

test('a legacy fixed wallet can start a new moving market, while an empty corrupt cache is preserved', async () => {
  const legacy = fixture({ workspaceRead: () => Promise.resolve(JSON.stringify({ wallet: { positions: [{ symbol: 'EUR/USD' }] } })) });
  await legacy.settle();
  assert.equal(legacy.value.ready, true);
  legacy.unmount();
  const corrupt = fixture({ read: () => Promise.resolve('') });
  await corrupt.settle();
  assert.equal(corrupt.value.ready, false);
  assert.equal(corrupt.writes.length, 0);
  corrupt.unmount();
});

test('queued price saves retain the executable marks from each caller save boundary', async () => {
  const h = fixture({ read: () => new Promise(() => {}) });
  const original = h.engine.demoMarket.getSnapshot().asOf;
  const first = h.persist();
  h.engine.demoMarket.tick(original + 1000);
  const second = h.persist();
  h.engine.demoMarket.tick(original + 2000);
  await Promise.all([first, second]);
  assert.deepEqual(h.writes.map(write => write.value.asOf), [original, original + 1000]);
  assert.notEqual(h.writes[0].value.quotes['EUR/USD'].price, h.writes[1].value.quotes['EUR/USD'].price);
  h.unmount();
});

test('a successful retry clears a previous demo-price save error', async () => {
  let fail = true;
  const h = fixture({ write: async () => { if (fail) throw new Error('storage unavailable'); } });
  await h.settle();
  h.state('background');
  await h.settle();
  assert.match(h.value.storageError, /could not be saved/);
  fail = false;
  h.state('active');
  h.value.setPaused(true); h.render();
  await h.settle();
  assert.equal(h.value.storageError, '');
  h.unmount();
});
