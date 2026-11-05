const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, Request, Response, URL, URLSearchParams,
    AbortController, setTimeout, clearTimeout, process: { env: {} }, ...globals,
    require: name => load(path.resolve(path.dirname(file), `${name}.ts`), globals),
  }, { filename: file });
  return module.exports;
}

const { createMarketApi } = load('src/server/marketApi.ts');
const initialTime = Date.parse('2026-11-05T06:00:00Z');
const secret = 'private-twelve-key-never-public';
const newsSecret = 'private-news-key-never-public';
const configured = {
  MARKET_DATA_DISPLAY_ALLOWED: '1', TWELVE_DATA_API_KEY: secret, MARKETAUX_API_KEY: newsSecret,
  TWELVE_DATA_SYMBOLS_JSON: JSON.stringify({ 'WTI/USD': 'WTI/USD', 'SPX/USD': 'VERIFIED_SP500' }),
};
const quote = (time = initialTime) => ({ close: '1.125', percent_change: '-0.5', last_quote_at: time / 1000 - 60, timestamp: time / 1000 - 86400, is_market_open: true });
const candles = () => ({ values: [
  { datetime: '2026-11-05 05:00:00', open: '1.1', high: '1.3', low: '1.0', close: '1.2' },
  { datetime: '2026-11-05 03:00:00', open: '1.0', high: '1.2', low: '0.9', close: '1.1' },
  { datetime: '2026-11-05 05:00:00', open: '1.1', high: '1.4', low: '1.0', close: '1.25' },
] });
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const request = (kind = 'quote', symbol = 'EUR/USD', timeframe = '1h') => new Request(`https://pipwise.test/api/market?${new URLSearchParams({ kind, symbol, timeframe })}`);
async function call(api, ...args) {
  const result = await api(request(...args));
  return { result, body: await result.json() };
}

test('missing keys or display permission fail closed without contacting a provider', async () => {
  let calls = 0;
  const fetch = async () => { calls++; return response(quote()); };
  for (const env of [{}, { TWELVE_DATA_API_KEY: secret }, { MARKET_DATA_DISPLAY_ALLOWED: '1' }, { ...configured, MARKET_DATA_DISPLAY_ALLOWED: '0' }]) {
    const api = createMarketApi({ env, fetch, now: () => initialTime });
    const { result, body } = await call(api);
    assert.equal(result.status, 503);
    assert.deepEqual(body, { error: { code: 'NOT_CONFIGURED', message: 'Market prices are not connected yet.' } });
  }
  const api = createMarketApi({ env: { MARKET_DATA_DISPLAY_ALLOWED: '1', TWELVE_DATA_API_KEY: secret }, fetch, now: () => initialTime });
  assert.equal((await call(api, 'news')).result.status, 503);
  assert.equal(calls, 0);
});

test('only the seven known markets and supported resources/timeframes reach providers', async () => {
  let calls = 0;
  const api = createMarketApi({ env: configured, fetch: async () => { calls++; return response(quote()); }, now: () => initialTime });
  for (const params of [['quote', 'SPY'], ['quote', 'https://private.test'], ['orders', 'EUR/USD'], ['candles', 'EUR/USD', '1s']]) {
    assert.equal((await call(api, ...params)).result.status, 400);
  }
  const duplicate = await api(new Request('https://pipwise.test/api/market?kind=quote&symbol=EUR%2FUSD&symbol=BTC%2FUSD'));
  assert.equal(duplicate.status, 400);
  assert.equal((await api(new Request('https://pipwise.test/api/market', { method: 'POST' }))).status, 405);
  assert.equal(calls, 0);
});

test('instrument overrides are explicit and validated, with no silent stock/index substitution', async () => {
  let calls = 0;
  const fetch = async () => { calls++; return response(quote()); };
  const base = { MARKET_DATA_DISPLAY_ALLOWED: '1', TWELVE_DATA_API_KEY: secret };
  for (const symbol of ['WTI/USD', 'SPX/USD']) {
    const api = createMarketApi({ env: base, fetch, now: () => initialTime });
    const result = await call(api, 'quote', symbol);
    assert.equal(result.result.status, 503);
    assert.equal(result.body.error.code, 'INSTRUMENT_NOT_CONFIGURED');
  }
  for (const value of ['{broken', '[]', '{"SPY":"SPY"}', '{"EUR/USD":"https://untrusted.test"}']) {
    const api = createMarketApi({ env: { ...base, TWELVE_DATA_SYMBOLS_JSON: value }, fetch, now: () => initialTime });
    assert.equal((await call(api)).result.status, 503);
  }
  assert.equal(calls, 0);
});

test('quotes preserve the provider timestamp and never label receive time as a market observation', async () => {
  const api = createMarketApi({ env: configured, fetch: async () => response(quote()), now: () => initialTime });
  const { body } = await call(api);
  assert.equal(body.data.price, 1.125);
  assert.equal(body.data.changePercent, -0.5);
  assert.equal(body.data.asOf, initialTime - 60000);
  assert.equal(body.data.receivedAt, initialTime);
  assert.equal(body.data.kind, 'reference');
  assert.equal(body.data.marketOpen, true);
  assert.equal(body.cache.hit, false);
  assert.equal(body.cache.expiresAt, initialTime + 900000);
  const missing = createMarketApi({ env: configured, fetch: async () => response({ close: '1.2' }), now: () => initialTime });
  assert.equal((await call(missing)).result.status, 502);
});

test('provider metadata cannot silently substitute an ETF, foreign-currency stock, or another symbol', async () => {
  for (const extra of [{ symbol: 'OTHER' }, { type: 'ETF' }, { currency: 'EUR' }]) {
    const api = createMarketApi({ env: configured, fetch: async () => response({ ...quote(), ...extra }), now: () => initialTime });
    const { result, body } = await call(api, 'quote', 'SPX/USD');
    assert.equal(result.status, 502);
    assert.equal(body.error.code, 'INSTRUMENT_UNAVAILABLE');
  }
});

test('concurrent requests deduplicate, cached reads do not spend credits, and expiry refetches', async () => {
  let finish;
  let calls = 0;
  let clock = initialTime;
  const fetch = async () => { calls++; if (calls === 1) return new Promise(resolve => { finish = resolve; }); return response(quote(clock)); };
  const api = createMarketApi({ env: configured, fetch, now: () => clock });
  const first = call(api), concurrent = call(api);
  assert.equal(calls, 1);
  finish(response(quote()));
  assert.equal((await first).result.status, 200);
  assert.equal((await concurrent).result.status, 200);
  assert.equal((await call(api)).body.cache.hit, true);
  assert.equal(calls, 1);
  clock += 900001;
  assert.equal((await call(api)).body.cache.hit, false);
  assert.equal(calls, 2);
});

test('candles are UTC milliseconds, positive valid OHLC, sorted/deduplicated without filling gaps', async () => {
  let requested;
  const api = createMarketApi({ env: configured, fetch: async url => { requested = url; return response(candles()); }, now: () => initialTime });
  const { body } = await call(api, 'candles');
  assert.equal(requested.searchParams.get('interval'), '1h');
  assert.equal(requested.searchParams.get('timezone'), 'UTC');
  assert.equal(body.data.candles.length, 2);
  assert.equal(body.data.candles[0].time, Date.parse('2026-11-05T03:00:00Z'));
  assert.equal(body.data.candles[1].time, Date.parse('2026-11-05T05:00:00Z'));
  assert.equal(body.data.candles[1].close, 1.25);
  assert.equal(body.data.asOf, body.data.candles[1].time);
  for (const invalid of [
    { ...candles(), values: [] },
    { values: [{ datetime: '2026-11-05 05:00:00', open: '2', high: '1', low: '.5', close: '1' }] },
    { values: [{ datetime: '2026-11-05 05:00:00', open: '0', high: '1', low: '.5', close: '.8' }] },
    { values: [{ datetime: '2026-02-30 05:00:00', open: '1', high: '2', low: '.5', close: '1' }] },
  ]) {
    const broken = createMarketApi({ env: configured, fetch: async () => response(invalid), now: () => initialTime });
    assert.equal((await call(broken, 'candles')).result.status, 502);
  }
});

test('provider quota errors including JSON429 in HTTP200 become sanitized429 with Retry-After', async () => {
  for (const providerResponse of [
    response({ code: 429, status: 'error', message: `private ${secret}` }),
    new Response(`private ${secret}`, { status: 429, headers: { 'Retry-After': '23' } }),
    response({ error: { code: 'usage_limit_reached', message: newsSecret } }, 402),
  ]) {
    const api = createMarketApi({ env: configured, fetch: async () => providerResponse, now: () => initialTime });
    const { result, body } = await call(api);
    assert.equal(result.status, 429);
    assert(Number(result.headers.get('retry-after')) > 0);
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(JSON.stringify(body).includes(secret), false);
    assert.equal(JSON.stringify(body).includes(newsSecret), false);
  }
});

test('per-worker price budgets cap eight calls per minute, while successful cache remains usable', async () => {
  const all = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'XAU/USD', 'WTI/USD', 'SPX/USD'];
  let calls = 0;
  let clock = initialTime;
  const api = createMarketApi({ env: configured, now: () => clock, fetch: async url => { calls++; return response(url.pathname === '/quote' ? quote() : candles()); } });
  for (const symbol of all) assert.equal((await call(api, 'quote', symbol)).result.status, 200);
  assert.equal((await call(api, 'candles', all[0])).result.status, 200);
  const limit = await call(api, 'candles', all[1]);
  assert.equal(limit.result.status, 429);
  assert.equal(limit.result.headers.get('retry-after'), '60');
  assert.equal(calls, 8);
  assert.equal((await call(api)).body.cache.hit, true);
  clock += 60000;
  assert.equal((await call(api, 'candles', all[1])).result.status, 200);
});

test('the conservative daily price budget stops at800 and resets on the next UTC day', async () => {
  const all = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'XAU/USD', 'WTI/USD', 'SPX/USD'];
  const frames = ['1m', '5m', '15m', '1h', '4h', '1D'];
  const resources = all.flatMap(symbol => [['quote', symbol], ...frames.map(frame => ['candles', symbol, frame])]);
  let clock = initialTime, calls = 0;
  const api = createMarketApi({ env: configured, now: () => clock, fetch: async url => { calls++; return response(url.pathname === '/quote' ? quote() : candles()); } });
  for (let index = 0; index < 800; index++) {
    assert.equal((await call(api, ...resources[index % resources.length])).result.status, 200, `request ${index}`);
    clock += 20000;
  }
  const exhausted = await call(api, ...resources[800 % resources.length]);
  assert.equal(exhausted.result.status, 429);
  assert.equal(calls, 800);
  clock = Date.parse('2026-11-06T00:01:00Z');
  assert.equal((await call(api)).result.status, 200);
  assert.equal(calls, 801);
});

test('news returns bounded title/link metadata and only matching entity sentiment, without body or keys', async () => {
  const article = {
    uuid: 'story-one', title: '<b>Bitcoin rises</b>', url: 'https://publisher.test/bitcoin', source: 'publisher.test', published_at: '2026-11-05T05:00:00Z',
    description: `private ${newsSecret}`, snippet: 'copyrighted full text', image_url: 'https://image.test/private',
    entities: [{ symbol: 'BTC', name: 'Bitcoin', type: 'cryptocurrency', sentiment_score: .7, match_score: 34.2 }],
  };
  let calls = 0, clock = initialTime;
  const api = createMarketApi({ env: configured, now: () => clock, fetch: async url => {
    calls++; assert.equal(url.hostname, 'api.marketaux.com'); assert.equal(url.searchParams.get('limit'), '3');
    return response({ data: [article, { ...article }, { ...article, uuid: 'unsafe', url: 'javascript:alert(1)' },
      { ...article, uuid: 'secret', url: `https://publisher.test/?api_token=${newsSecret}` },
      { ...article, uuid: 'unrelated', url: 'https://publisher.test/stock', entities: [{ symbol: 'BTC', name: 'Some stock', type: 'equity', sentiment_score: 1, match_score: 99 }] }] });
  } });
  const { body } = await call(api, 'news', 'BTC/USD');
  assert.equal(body.data.articles.length, 2);
  assert.equal(body.data.articles[0].title, 'Bitcoin rises');
  assert.deepEqual(body.data.articles[0].sentiment, { score: .7, relevance: 34.2, entity: 'Bitcoin' });
  assert.equal(body.data.articles[1].sentiment, undefined);
  assert.deepEqual(body.data.articles[1].symbols, []);
  for (const forbidden of [newsSecret, secret, 'snippet', 'image_url', 'description', 'copyrighted full text', 'api_token']) assert.equal(JSON.stringify(body).includes(forbidden), false);
  clock += 1800000;
  assert.equal((await call(api, 'news', 'BTC/USD')).body.cache.hit, true);
  assert.equal(calls, 1);
});

test('news deduplicates provider article IDs as well as URLs and uses bounded fallback IDs', async () => {
  const base = { title: 'Bitcoin market update', source: 'publisher.test', published_at: '2026-11-05T05:00:00Z', entities: [] };
  const longUrl = `https://publisher.test/bitcoin?article=${'x'.repeat(500)}`;
  const api = createMarketApi({ env: configured, now: () => initialTime, fetch: async () => response({ data: [
    { ...base, uuid: 'same-provider-id', url: 'https://publisher.test/original' },
    { ...base, uuid: 'same-provider-id', url: 'https://publisher.test/duplicate-id' },
    { ...base, uuid: 'different-id', url: 'https://publisher.test/original' },
    { ...base, url: longUrl },
  ] }) });
  const { body } = await call(api, 'news', 'BTC/USD');
  assert.equal(body.data.articles.length, 2);
  assert.equal(new Set(body.data.articles.map(article => article.id)).size, 2);
  assert.equal(body.data.articles[0].id, 'same-provider-id');
  assert.match(body.data.articles[1].id, /^url:[a-f0-9]+$/);
  assert.equal(body.data.articles[1].url, longUrl);
});

test('normalized server quote, candle, and news responses satisfy the real client contract without network', async () => {
  const { createMarketClient } = load('src/lib/marketClient.ts');
  const server = createMarketApi({ env: configured, now: () => initialTime, fetch: async url => response(
    url.hostname === 'api.marketaux.com' ? { data: [{
      title: 'Bitcoin news', url: `https://publisher.test/story?article=${'x'.repeat(500)}`,
      published_at: '2026-11-05T05:00:00Z', source: 'publisher.test',
      entities: [{ symbol: 'BTC', name: 'Bitcoin', type: 'cryptocurrency', sentiment_score: .2, match_score: 34 }],
    }] } : url.pathname === '/quote' ? quote() : candles()) });
  const saved = new Map();
  const client = createMarketClient({
    baseUrl: 'https://pipwise.test', now: () => initialTime,
    storage: { getItem: async key => saved.get(key) ?? null, setItem: async (key, value) => { saved.set(key, value); }, removeItem: async key => { saved.delete(key); } },
    fetch: (url, options) => server(new Request(url, options)),
  });
  for (const kind of ['quote', 'candles', 'news']) {
    await client.refresh(kind, 'BTC/USD');
    assert.equal(client.getSnapshot(kind, 'BTC/USD').state, 'ready', kind);
    assert.equal(client.getSnapshot(kind, 'BTC/USD').error, null);
  }
  await client.flushCache();
});

test('upstream failures are sanitized and expired success is not relabelled fresh', async () => {
  let clock = initialTime, calls = 0;
  const api = createMarketApi({ env: configured, now: () => clock, fetch: async () => {
    calls++;
    if (calls > 1) throw new Error(`https://api.twelvedata.com/quote?apikey=${secret}`);
    return response(quote());
  } });
  assert.equal((await call(api)).result.status, 200);
  clock += 900001;
  const failed = await call(api);
  assert.equal(failed.result.status, 502);
  assert.equal(failed.body.data, undefined);
  assert.equal(JSON.stringify(failed.body).includes(secret), false);
  assert.equal(JSON.stringify(failed.body).includes('twelvedata.com'), false);
});

test('provider requests abort after the ten-second server timeout', async () => {
  let expire;
  let observedSignal;
  const { createMarketApi: createControlled } = load('src/server/marketApi.ts', {
    setTimeout(callback, milliseconds) { assert.equal(milliseconds, 10000); expire = callback; return 1; },
    clearTimeout() {},
  });
  const api = createControlled({ env: configured, now: () => initialTime, fetch: async (_url, options) => new Promise((_resolve, reject) => {
    observedSignal = options.signal;
    observedSignal.addEventListener('abort', () => reject(new Error('Aborted request')));
  }) });
  const pending = call(api);
  assert.equal(observedSignal.aborted, false);
  expire();
  const { result, body } = await pending;
  assert.equal(observedSignal.aborted, true);
  assert.equal(result.status, 502);
  assert.equal(body.error.code, 'PROVIDER_TIMEOUT');
});

test('the Expo API route exposes GET and fails closed without server configuration', async () => {
  const { GET } = load('src/app/api/market+api.ts');
  const result = await GET(request());
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error.code, 'NOT_CONFIGURED');
});
