const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, URL, URLSearchParams, Promise, AbortController, setTimeout, clearTimeout,
    require: name => load(path.resolve(path.dirname(file), `${name}.ts`)),
  }, { filename: file });
  return module.exports;
}
const { createMarketClient, normalizeMarketApiUrl } = load('src/lib/marketClient.ts');
const start = Date.parse('2026-11-05T12:00:00Z');
const endpoint = 'https://market.example.test/api/market';
const key = 'pipwise.market.v1';
const quote = (overrides = {}) => ({ symbol: 'EUR/USD', price: 1.1, changePercent: 0.5, asOf: start - 1000, receivedAt: start, source: 'Twelve Data', kind: 'reference', marketOpen: null, ...overrides });
const candles = (overrides = {}) => ({ symbol: 'EUR/USD', timeframe: '1h', asOf: start - 3600000, receivedAt: start, source: 'Twelve Data', candles: [
  { time: start - 7200000, open: 1.1, high: 1.3, low: 1, close: 1.2 },
  { time: start - 3600000, open: 1.2, high: 1.4, low: 1.1, close: 1.3 },
], ...overrides });
const news = (overrides = {}) => ({ symbol: 'EUR/USD', receivedAt: start, source: 'Marketaux', articles: [{ id: 'article-1', title: 'Market context', url: 'https://news.example.test/story', source: 'Example News', publishedAt: start - 10000, symbols: ['EUR/USD'], sentiment: { entity: 'Euro', score: -0.2, relevance: 34 } }], ...overrides });
const ok = (data, expiresAt = start + 60000, hit = false) => ({ ok: true, status: 200, json: async () => ({ data, cache: { expiresAt, hit } }) });
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({ initial = new Map(), baseUrl = endpoint, timeoutMs = 10000, storage: customStorage } = {}) {
  let time = start;
  let fetcher = async () => ok(quote());
  const requests = [];
  const writes = [];
  const removals = [];
  const storage = customStorage || {
    getItem: async name => initial.get(name) ?? null,
    setItem: async (name, value) => { writes.push({ name, value }); initial.set(name, value); },
    removeItem: async name => { removals.push(name); initial.delete(name); },
  };
  const client = createMarketClient({ storage, baseUrl, timeoutMs, now: () => time, fetch: async (url, options) => {
    requests.push({ url, options });
    return fetcher(url, options);
  } });
  return { client, storage: initial, requests, writes, removals, advance: amount => { time += amount; }, respond: next => { fetcher = next; } };
}

test('market API configuration accepts only a public HTTPS endpoint or web relative path', () => {
  assert.equal(normalizeMarketApiUrl('https://market.example.test'), endpoint);
  assert.equal(normalizeMarketApiUrl(`${endpoint}/`), endpoint);
  assert.equal(normalizeMarketApiUrl('/api/market'), '/api/market');
  for (const value of [null, '', 'http://market.example.test', 'https://user:secret@market.example.test', `${endpoint}?key=secret`, `${endpoint}#fragment`, 'https://market.example.test/other']) assert.equal(normalizeMarketApiUrl(value), null);
});

test('quotes persist separately from workspace data and restore without an unnecessary request', async () => {
  const storage = new Map([['pipswise.workspace.v1', '{"wallet":"untouched"}']]);
  const first = harness({ initial: storage });
  await first.client.refresh('quote', 'EUR/USD');
  await first.client.flushCache();
  assert.equal(first.client.getSnapshot('quote', 'EUR/USD').data.price, 1.1);
  assert.equal(first.requests[0].options.method, 'GET');
  const url = new URL(first.requests[0].url);
  assert.equal(url.searchParams.get('symbol'), 'EUR/USD');
  assert.equal(url.searchParams.get('kind'), 'quote');
  assert.equal(storage.get('pipswise.workspace.v1'), '{"wallet":"untouched"}');
  const saved = JSON.parse(storage.get(key));
  assert.equal(saved.version, 1);
  assert.equal(saved.endpoint, endpoint);
  const second = harness({ initial: storage });
  await second.client.refresh('quote', 'EUR/USD');
  const restored = second.client.getSnapshot('quote', 'EUR/USD');
  assert.equal(restored.state, 'ready');
  assert.equal(restored.fromCache, true);
  assert.equal(restored.data.price, 1.1);
  assert.equal(second.requests.length, 0);
});

test('TTL respects an earlier server expiry and caps quote/candle/news caching', async () => {
  for (const [kind, data, maximum] of [['quote', quote(), 900000], ['candles', candles(), 900000], ['news', news(), 3600000]]) {
    const h = harness();
    h.respond(async () => ok(data, start + maximum * 10));
    await h.client.refresh(kind, 'EUR/USD');
    h.advance(maximum - 1);
    assert.equal(h.client.getSnapshot(kind, 'EUR/USD').state, 'ready');
    h.advance(1);
    const stale = h.client.getSnapshot(kind, 'EUR/USD');
    assert.equal(stale.state, 'stale');
    assert.equal(h.client.getSnapshot(kind, 'EUR/USD'), stale, 'unchanged snapshots must retain their identity');
  }
  const early = harness();
  early.respond(async () => ok(quote(), start + 5000));
  await early.client.refresh('quote', 'EUR/USD');
  early.advance(5000);
  assert.equal(early.client.getSnapshot('quote', 'EUR/USD').state, 'stale');
});

test('concurrent requests share one fetch and subscriptions receive stable published snapshots', async () => {
  const h = harness();
  let finish;
  h.respond(() => new Promise(resolve => { finish = resolve; }));
  const snapshots = [];
  const unsubscribe = h.client.subscribe('quote', 'EUR/USD', '1h', () => snapshots.push(h.client.getSnapshot('quote', 'EUR/USD')));
  const first = h.client.refresh('quote', 'EUR/USD');
  const duplicate = h.client.refresh('quote', 'EUR/USD');
  assert.equal(first, duplicate);
  await flush();
  assert.equal(h.requests.length, 1);
  finish(ok(quote()));
  await first;
  assert.deepEqual(snapshots.map(snapshot => snapshot.state), ['loading', 'ready']);
  const stable = h.client.getSnapshot('quote', 'EUR/USD');
  assert.equal(h.client.getSnapshot('quote', 'EUR/USD'), stable);
  unsubscribe();
});

test('only subscribed expired resources refresh automatically', async () => {
  const h = harness();
  const unsubscribe = h.client.subscribe('quote', 'EUR/USD', '1h', () => {});
  await h.client.refreshStale();
  assert.equal(h.requests.length, 1);
  h.advance(59999);
  await h.client.refreshStale();
  assert.equal(h.requests.length, 1);
  h.advance(1);
  await h.client.refreshStale();
  assert.equal(h.requests.length, 2);
  unsubscribe();
  h.advance(60000);
  await h.client.refreshStale();
  assert.equal(h.requests.length, 2);
});

test('unreachable feed retains the last good quote and does not claim the device is offline', async () => {
  const h = harness();
  await h.client.refresh('quote', 'EUR/USD');
  const lastGood = h.client.getSnapshot('quote', 'EUR/USD').data;
  h.respond(async () => { throw new Error('network rejected'); });
  await h.client.refresh('quote', 'EUR/USD', '1h', true);
  const failed = h.client.getSnapshot('quote', 'EUR/USD');
  assert.equal(failed.data, lastGood);
  assert.equal(failed.state, 'stale');
  assert.equal(failed.fromCache, true);
  assert.match(failed.error, /feed could not be reached/);
  assert.ok(!/device|internet|you are offline/i.test(failed.error));
  const empty = harness();
  empty.respond(async () => { throw new Error('unreachable'); });
  await empty.client.refresh('quote', 'EUR/USD');
  assert.equal(empty.client.getSnapshot('quote', 'EUR/USD').state, 'offline');
  assert.equal(empty.client.getSnapshot('quote', 'EUR/USD').data, null);
});

test('missing backend and service 503 are unavailable, while other HTTP failures are errors', async () => {
  const missing = harness({ baseUrl: null });
  await missing.client.refresh('quote', 'EUR/USD');
  assert.equal(missing.requests.length, 0);
  assert.equal(missing.client.getSnapshot('quote', 'EUR/USD').state, 'unavailable');
  assert.equal(missing.client.getSnapshot('quote', 'EUR/USD').data, null);
  for (const status of [400, 429, 502, 503]) {
    const h = harness();
    h.respond(async () => ({ ok: false, status, json: async () => ({ error: { code: 'PRIVATE', message: 'provider secret diagnostic' } }) }));
    await h.client.refresh('quote', 'EUR/USD');
    const failed = h.client.getSnapshot('quote', 'EUR/USD');
    assert.equal(failed.state, status === 503 ? 'unavailable' : 'error');
    assert.equal(failed.data, null);
    assert.ok(!failed.error.includes('secret'));
  }
});

test('invalid symbols, timestamps, OHLC, and article URLs never produce fabricated data', async () => {
  const badSeries = [candles({ symbol: 'BTC/USD' }), candles({ receivedAt: 1700000000 }), candles({ candles: [{ ...candles().candles[0], high: 0.5 }] }), candles({ candles: [...candles().candles].reverse() })];
  for (const [kind, data] of [
    ['quote', quote({ price: 0 })], ['quote', quote({ price: NaN })], ['quote', quote({ asOf: start + 600000 })],
    ...badSeries.map(series => ['candles', series]),
    ['news', news({ articles: [{ ...news().articles[0], url: 'javascript:alert(1)' }] })],
  ]) {
    const h = harness();
    h.respond(async () => ok(data));
    await h.client.refresh(kind, 'EUR/USD');
    assert.equal(h.client.getSnapshot(kind, 'EUR/USD').state, 'error');
    assert.equal(h.client.getSnapshot(kind, 'EUR/USD').data, null);
  }
  const unsupported = harness();
  await unsupported.client.refresh('quote', 'UNSUPPORTED');
  assert.equal(unsupported.requests.length, 0);
  assert.equal(unsupported.client.getSnapshot('quote', 'UNSUPPORTED').data, null);
  const validNews = harness();
  validNews.respond(async () => ok(news()));
  await validNews.client.refresh('news', 'EUR/USD');
  assert.equal(validNews.client.getSnapshot('news', 'EUR/USD').data.articles[0].sentiment.relevance, 34);
});

test('corrupt cache alone is discarded and valid entries survive neighboring corruption', async () => {
  for (const raw of ['{broken', JSON.stringify({ version: 2, endpoint, entries: [] }), JSON.stringify({ version: 1, endpoint: 'https://other.example.test/api/market', entries: [] })]) {
    const storage = new Map([[key, raw], ['pipswise.workspace.v1', 'retained-wallet']]);
    const h = harness({ initial: storage });
    await h.client.hydrate();
    await h.client.flushCache();
    assert.deepEqual(h.removals, [key]);
    assert.equal(storage.get('pipswise.workspace.v1'), 'retained-wallet');
  }
  const saved = { kind: 'quote', symbol: 'EUR/USD', timeframe: '1h', data: quote(), expiresAt: start + 60000, lastCheckedAt: start };
  const h = harness({ initial: new Map([[key, JSON.stringify({ version: 1, endpoint, entries: [saved, { ...saved, symbol: 'wrong' }] })]]) });
  await h.client.hydrate();
  await h.client.flushCache();
  assert.equal(h.client.getSnapshot('quote', 'EUR/USD').data.price, 1.1);
  assert.equal(JSON.parse(h.storage.get(key)).entries.length, 1);
  const oversized = harness({ initial: new Map([[key, JSON.stringify({ version: 1, endpoint, entries: Array(200).fill(saved) })]]) });
  await oversized.client.hydrate();
  await oversized.client.flushCache();
  assert.ok(JSON.parse(oversized.storage.get(key)).entries.length <= 128);
});

test('cache writes serialize and the final snapshot cannot be overwritten by an older save', async () => {
  const storage = new Map();
  const writes = [];
  let release;
  let active = 0;
  let peak = 0;
  const h = harness({ storage: {
    getItem: async () => null,
    removeItem: async name => storage.delete(name),
    setItem: async (name, value) => {
      active++; peak = Math.max(peak, active);
      if (!writes.length) await new Promise(resolve => { release = resolve; });
      writes.push(JSON.parse(value)); storage.set(name, value); active--;
    },
  } });
  await h.client.refresh('quote', 'EUR/USD');
  await flush();
  h.respond(async () => ok(quote({ price: 1.2 })));
  await h.client.refresh('quote', 'EUR/USD', '1h', true);
  assert.equal(writes.length, 0);
  release();
  await h.client.flushCache();
  assert.equal(peak, 1);
  assert.equal(writes.length, 2);
  assert.equal(JSON.parse(storage.get(key)).entries[0].data.price, 1.2);
});

test('fetch and response-body deadlines abort stalled work and allow a fresh retry', async () => {
  for (const bodyStalls of [false, true]) {
    const h = harness({ timeoutMs: 5 });
    h.respond(async () => bodyStalls ? { ok: true, status: 200, json: () => new Promise(() => {}) } : new Promise(() => {}));
    await h.client.refresh('quote', 'EUR/USD');
    assert.equal(h.requests[0].options.signal.aborted, true);
    assert.equal(h.client.getSnapshot('quote', 'EUR/USD').state, 'offline');
    assert.match(h.client.getSnapshot('quote', 'EUR/USD').error, /did not respond in time/);
    h.respond(async () => ok(quote()));
    await h.client.refresh('quote', 'EUR/USD', '1h', true);
    assert.equal(h.client.getSnapshot('quote', 'EUR/USD').state, 'ready');
  }
});

test('a stalled cache read cannot block the feed or overwrite its newer result later', async () => {
  let finishRead;
  const h = harness({ timeoutMs: 5, storage: {
    getItem: () => new Promise(resolve => { finishRead = resolve; }),
    setItem: async () => {},
    removeItem: async () => {},
  } });
  h.respond(async () => ok(quote({ price: 1.2 })));
  await h.client.refresh('quote', 'EUR/USD');
  assert.equal(h.client.getSnapshot('quote', 'EUR/USD').data.price, 1.2);
  finishRead(JSON.stringify({ version: 1, endpoint, entries: [{ kind: 'quote', symbol: 'EUR/USD', timeframe: '1h', data: quote({ price: 0.9 }), expiresAt: start + 60000, lastCheckedAt: start }] }));
  await flush();
  assert.equal(h.client.getSnapshot('quote', 'EUR/USD').data.price, 1.2);
});

function providerHarness(initialState = 'background', clientFactory) {
  const effects = [];
  const intervals = new Map();
  const listeners = new Set();
  const calls = [];
  const createdClients = [];
  let timerId = 0;
  const client = {
    hydrate: async () => { calls.push('hydrate'); },
    refreshStale: async () => { calls.push('refreshStale'); },
    refresh: async () => { calls.push('refresh'); },
    subscribe: () => { calls.push('subscribe'); return () => {}; },
    getSnapshot: () => { calls.push('snapshot'); return { data: null, state: 'idle' }; },
  };
  const react = {
    createContext: () => { const context = { current: null }; context.Provider = { context }; return context; },
    createElement: (type, props) => { if (type.context) type.context.current = props.value; return props; },
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: effect => effects.push(effect),
    useCallback: callback => callback,
    useContext: context => context.current,
    useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => {}); return snapshot(); },
  };
  react.default = react;
  const appState = { currentState: initialState, addEventListener: (_type, listener) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } };
  const imports = {
    react,
    '@react-native-async-storage/async-storage': {},
    'react-native': { Platform: { OS: 'android' }, AppState: appState },
    './marketClient': { createMarketClient: () => { const instance = clientFactory ? clientFactory() : client; createdClients.push(instance); return instance; }, normalizeMarketApiUrl },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/marketProvider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, process: { env: {} },
    setInterval: callback => { const id = ++timerId; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return { ...module.exports, calls, effects, intervals, listeners, createdClients, state: next => { appState.currentState = next; listeners.forEach(listener => listener(next)); } };
}

test('provider lifecycle starts polling only in the foreground and clears timers on background/unmount', () => {
  const h = providerHarness();
  h.MarketDataProvider({ children: null });
  const cleanup = h.effects.shift()();
  assert.deepEqual(h.calls, ['hydrate']);
  assert.equal(h.intervals.size, 0);
  h.state('active');
  assert.equal(h.intervals.size, 1);
  assert.deepEqual(h.calls, ['hydrate', 'refreshStale']);
  [...h.intervals.values()][0]();
  assert.equal(h.calls.filter(value => value === 'refreshStale').length, 2);
  h.state('background');
  assert.equal(h.intervals.size, 0);
  h.state('active');
  assert.equal(h.intervals.size, 1);
  cleanup();
  assert.equal(h.intervals.size, 0);
  assert.equal(h.listeners.size, 0);
});

test('disabled sample resources never subscribe, request, or refresh market data', async () => {
  const h = providerHarness('active');
  h.MarketDataProvider({ children: null });
  h.effects.length = 0;
  const resource = h.useMarketResource('quote', 'EUR/USD', '1h', false);
  h.effects.forEach(effect => effect());
  await resource.refresh();
  assert.equal(resource.state, 'idle');
  assert.equal(resource.data, null);
  assert.deepEqual(h.calls, []);
});

test('reopening the market route reuses pending work and one persisted cache queue', async () => {
  const saved = new Map();
  let requests = 0;
  let release;
  const storage = {
    getItem: async name => saved.get(name) ?? null,
    setItem: async (name, value) => saved.set(name, value),
    removeItem: async name => saved.delete(name),
  };
  const h = providerHarness('active', () => createMarketClient({ storage, baseUrl: endpoint, now: () => start,
    fetch: () => { requests++; return new Promise(resolve => { release = resolve; }); },
  }));
  const first = h.MarketDataProvider({ children: null }).value;
  const cleanup = h.effects.shift()();
  const pending = first.refresh('quote', 'EUR/USD');
  await flush();
  cleanup();
  assert.equal(h.intervals.size, 0);

  const reopened = h.MarketDataProvider({ children: null }).value;
  const finish = h.effects.shift()();
  const resumed = reopened.refresh('quote', 'EUR/USD');
  await flush();
  assert.equal(h.createdClients.length, 1, 'navigation must not create an independent cache writer');
  assert.equal(reopened, first);
  assert.equal(resumed, pending);
  assert.equal(requests, 1, 'an unfinished request must not spend another provider credit after reopening');
  release(ok(quote({ price: 1.2 })));
  await resumed;
  await reopened.flushCache();
  assert.equal(JSON.parse(saved.get(key)).entries[0].data.price, 1.2);
  await reopened.refresh('quote', 'EUR/USD');
  assert.equal(requests, 1, 'the last good response remains available through navigation');
  finish();
  assert.equal(h.intervals.size, 0);
  assert.equal(h.listeners.size, 0);
});
