const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Date, Math, Number, Object, Array, Set, URL,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}
const types = load('src/lib/marketTypes.ts');
const { analyzeMarket } = load('src/lib/marketAnalysis.ts', { './marketTypes': types });
const now = Date.parse('2026-11-05T12:00:00Z');
const hour = 3600000;

function series(closes, timeframe = '1h') {
  const interval = types.timeframeMilliseconds[timeframe];
  return {
    symbol: 'EUR/USD', timeframe, source: 'Verified test candles', asOf: now - interval, receivedAt: now,
    candles: closes.map((close, i) => ({ open: close, high: close + 1, low: close - 1, close, time: now - (closes.length - i) * interval })),
  };
}
const flat = () => series(Array(120).fill(100));
function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `Expected ${actual} near ${expected}`);
}

test('flat candles produce neutral RSI, zero MACD, stable EMA and nondirectional ATR', () => {
  const input = flat();
  const saved = JSON.stringify(input);
  const result = analyzeMarket(input, { now });
  assert.equal(result.status, 'ready');
  assert.equal(result.bias, 'mixed');
  for (const name of ['ema20', 'ema50']) near(result.indicators[name], 100);
  near(result.indicators.rsi14, 50);
  for (const name of ['macd', 'macdSignal', 'macdHistogram']) near(result.indicators[name], 0);
  near(result.indicators.atr14, 2);
  assert.equal(result.metadata.lastClosedAt, now);
  assert.equal(result.metadata.candlesUsed, 120);
  assert.equal(result.metadata.source, input.source);
  assert.equal(result.metadata.timeframe, '1h');
  assert.equal(result.metadata.sample, false);
  assert.equal(JSON.stringify(input), saved, 'analysis must not mutate input candles');
});

test('linear rising and falling series match closed-form EMA/MACD and extreme RSI', () => {
  const rising = analyzeMarket(series(Array.from({ length: 120 }, (_, i) => 100 + i)), { now });
  assert.equal(rising.status, 'ready');
  assert.equal(rising.bias, 'bullish');
  near(rising.indicators.ema20, 209.5);
  near(rising.indicators.ema50, 194.5);
  near(rising.indicators.macd, 7);
  near(rising.indicators.macdSignal, 7);
  near(rising.indicators.macdHistogram, 0);
  near(rising.indicators.rsi14, 100);
  near(rising.indicators.atr14, 2);
  assert.match(rising.explanation, /does not establish an imminent reversal/);
  const falling = analyzeMarket(series(Array.from({ length: 120 }, (_, i) => 400 - i)), { now });
  assert.equal(falling.bias, 'bearish');
  near(falling.indicators.ema20, 290.5);
  near(falling.indicators.ema50, 305.5);
  near(falling.indicators.macd, -7);
  near(falling.indicators.macdSignal, -7);
  near(falling.indicators.rsi14, 0);
  assert.match(falling.explanation, /does not establish an imminent rebound/);
});

test('last-bar price jump uses Wilder smoothing and previous close in true range', () => {
  const input = series([...Array(59).fill(100), 110]);
  const result = analyzeMarket(input, { now });
  near(result.indicators.ema20, 100 + 20 / 21);
  near(result.indicators.ema50, 100 + 20 / 51);
  const macd = 20 / 13 - 20 / 27;
  near(result.indicators.macd, macd);
  near(result.indicators.macdSignal, macd * 0.2);
  near(result.indicators.macdHistogram, macd * 0.8);
  near(result.indicators.atr14, 37 / 14);
  near(result.indicators.rsi14, 100);
  const retracement = analyzeMarket(series([...Array(58).fill(100), 114, 113]), { now });
  near(retracement.indicators.rsi14, 100 - 100 / 14);
});

test('unchanged zero-range candles remain finite and do not invent volatility', () => {
  const input = flat();
  input.candles = input.candles.map(candle => ({ ...candle, high: 100, low: 100 }));
  const result = analyzeMarket(input, { now });
  assert.equal(result.status, 'ready');
  assert.equal(result.bias, 'mixed');
  near(result.indicators.atr14, 0);
  near(result.indicators.rsi14, 50);
  assert.ok(Object.values(result.indicators).every(Number.isFinite));
});

test('insufficient histories expose no indicators or scenarios', () => {
  for (const count of [0, 14, 34, 50, 59]) {
    const result = analyzeMarket(series(Array(count).fill(100)), { now });
    assert.equal(result.status, 'insufficient');
    assert.equal(result.indicators, null);
    assert.equal(result.bias, 'mixed');
    assert.equal(result.scenarios.length, 0);
    assert.equal(result.metadata.candlesUsed, count);
  }
  assert.equal(analyzeMarket(series(Array(60).fill(100)), { now }).status, 'ready');
});

test('unfinished candles are excluded from indicators and trigger levels', () => {
  const input = flat();
  input.candles.push({ open: 100, high: 1000, low: 1, close: 500, time: now });
  const result = analyzeMarket(input, { now });
  assert.equal(result.status, 'ready');
  assert.equal(result.metadata.candlesUsed, 120);
  assert.equal(result.metadata.lastClosedAt, now);
  near(result.indicators.ema20, 100);
  assert.equal(result.scenarios[0].trigger, 101);
  assert.equal(result.scenarios[1].trigger, 99);
  const short = series(Array(59).fill(100));
  short.candles.push({ open: 100, high: 101, low: 99, close: 100, time: now });
  assert.equal(analyzeMarket(short, { now }).status, 'insufficient');
});

test('daily date anchors never establish that the latest exchange session is closed', () => {
  const day = 24 * hour;
  // The final Nov 4 UTC date anchor could represent an FX session that does
  // not finish until Nov 5 evening. UTC midnight alone cannot confirm it.
  const daily = series([...Array(60).fill(100), 200], '1D');
  daily.candles = daily.candles.map(candle => ({ ...candle, time: candle.time - 12 * hour }));
  daily.asOf = daily.candles.at(-1).time;
  assert.equal(new Date(daily.asOf).toISOString(), '2026-11-04T00:00:00.000Z');
  const result = analyzeMarket(daily, { now });
  assert.equal(result.status, 'ready');
  assert.equal(result.metadata.candlesUsed, 60);
  assert.equal(result.metadata.lastClosedAt, Date.parse('2026-11-04T00:00:00Z'));
  near(result.indicators.ema20, 100);
  near(result.indicators.rsi14, 50);
  assert.equal(result.scenarios[0].trigger, 101);
  const insufficient = series(Array(60).fill(100), '1D');
  assert.equal(analyzeMarket(insufficient, { now }).status, 'insufficient');
  const sample = analyzeMarket(daily, { now: now + 10 * day, sample: true });
  assert.equal(sample.status, 'ready');
  assert.equal(sample.metadata.candlesUsed, 60, 'sample bypasses age, not daily session safety');
});

test('malformed OHLC, future timestamps and unordered/duplicate candles are invalid', () => {
  const changes = [
    input => { input.candles[4].high = 99; },
    input => { input.candles[4].low = 101; },
    input => { input.candles[4].open = 0; },
    input => { input.candles[4].close = -1; },
    input => { input.candles[4].close = NaN; },
    input => { input.candles[4].high = Infinity; },
    input => { input.candles[4].close = '100'; },
    input => { input.candles[4].time = input.candles[3].time; },
    input => { [input.candles[3], input.candles[4]] = [input.candles[4], input.candles[3]]; },
    input => { input.candles[input.candles.length - 1].time = now + 1; },
    input => { input.asOf = now + 1; },
    input => { input.receivedAt = now + 1; },
    input => { input.timeframe = 'toString'; },
    input => { input.source = ''; },
  ];
  for (const change of changes) {
    const input = flat();
    change(input);
    const result = analyzeMarket(input, { now, sample: true });
    assert.equal(result.status, 'invalid');
    assert.equal(result.indicators, null);
    assert.equal(result.scenarios.length, 0);
  }
  assert.equal(analyzeMarket(null, { now }).status, 'invalid');
  assert.equal(analyzeMarket(flat(), { now: NaN }).status, 'invalid');
  assert.equal(analyzeMarket(flat(), { now, maxAgeMs: -1 }).status, 'invalid');
});

test('real staleness follows the candle interval while sample bypasses only staleness', () => {
  const input = flat();
  assert.equal(analyzeMarket(input, { now: now + 3 * hour }).status, 'ready');
  const result = analyzeMarket(input, { now: now + 3 * hour + 1 });
  assert.equal(result.status, 'stale');
  assert.equal(result.indicators, null);
  assert.equal(result.scenarios.length, 0);
  assert.equal(result.bias, 'mixed');
  const demo = analyzeMarket(input, { now: now + 72 * hour, sample: true });
  assert.equal(demo.status, 'ready');
  assert.equal(demo.metadata.sample, true);
  assert.equal(analyzeMarket(input, { now: now + 1, maxAgeMs: 0 }).status, 'stale');
  assert.equal(analyzeMarket(series(Array(120).fill(100), '1m'), { now: now + 30 * 60000 }).status, 'ready');
  assert.equal(analyzeMarket(series(Array(120).fill(100), '1m'), { now: now + 30 * 60000 + 1 }).status, 'stale');
});

test('scenario thresholds use prior twenty bars and make no price or probability forecast', () => {
  const input = series([...Array(59).fill(100), 110]);
  const result = analyzeMarket(input, { now });
  assert.equal(result.scenarios.length, 3);
  assert.equal(result.scenarios[0].name, 'Upside');
  assert.equal(result.scenarios[0].trigger, 101, 'latest high is not included in the preceding window');
  assert.equal(result.scenarios[1].trigger, 99);
  assert.equal(result.scenarios[2].trigger, null);
  for (const scenario of result.scenarios) assert.ok(scenario.description.length > 0);
  assert.doesNotMatch(JSON.stringify(result), /confidence|probability|guaranteed|[0-9]+%/i);
});

function article(id, changes = {}) {
  return { id, title: `Verified article ${id}`, source: 'Publisher', url: `https://publisher.example.test/${id}`,
    publishedAt: now - hour, symbols: ['EUR/USD'], ...changes };
}

test('news retains only recent relevant attributed articles and cannot flip technical bias', () => {
  const articles = [
    article('valid', { sentiment: { score: -0.9, relevance: 12.13, entity: 'Euro' } }),
    article('latest', { publishedAt: now }),
    article('valid'),
    article('duplicate-url', { url: 'https://publisher.example.test/valid' }),
    article('old', { publishedAt: now - 72 * hour - 1 }),
    article('future', { publishedAt: now + 1 }),
    article('other', { symbols: ['BTC/USD'] }),
    article('unattributed', { source: '' }),
    article('bad-link', { url: 'javascript:alert(1)' }),
    article('credentials', { url: 'https://user:password@publisher.example.test/story' }),
    article('bad-sentiment', { sentiment: { score: NaN, relevance: 0.2, entity: 'Euro' } }),
  ];
  const input = series(Array.from({ length: 120 }, (_, i) => 100 + i));
  const news = { symbol: 'EUR/USD', source: 'News provider', articles, receivedAt: now };
  const result = analyzeMarket(input, { now, news });
  assert.equal(result.bias, analyzeMarket(input, { now }).bias);
  assert.equal(result.newsContext.articles.length, 3);
  assert.equal(result.newsContext.articles[0].id, 'latest');
  assert.equal(result.newsContext.articles.find(item => item.id === 'valid').sentiment.relevance, 12.13);
  assert.equal(result.newsContext.articles.find(item => item.id === 'bad-sentiment').sentiment, undefined);
  assert.match(result.newsContext.summary, /does not establish price direction or cause/);
  assert.equal(result.newsContext.source, 'News provider');
  assert.equal(articles.length, 11, 'input news must not be modified');
  assert.equal(analyzeMarket(input, { now, news: { ...news, symbol: 'BTC/USD' } }).newsContext.articles.length, 0);
  assert.equal(analyzeMarket(input, { now, news: { ...news, receivedAt: now + 1 } }).newsContext.articles.length, 0);
  assert.match(analyzeMarket(input, { now }).newsContext.summary, /Missing coverage is not neutral/);
});
