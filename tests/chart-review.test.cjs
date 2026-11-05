const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, TextEncoder, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } }, { filename: file });
  return module.exports;
}
const types = load('src/lib/marketTypes.ts');
const review = load('src/lib/chartReview.ts', { './marketTypes': types });
const now = Date.UTC(2026, 10, 5, 12);
const minute = 60000;
const input = { symbol: 'EUR/USD', timeframe: '1m', strategy: 'ICT', context: '' };
const bars = (count = 100) => Array.from({ length: count }, (_, i) => ({ time: now - (count - i) * minute, open: 100, high: 101, low: 99, close: 100 }));
const normalize = value => JSON.parse(JSON.stringify(value));

test('imports CSV and JSON with explicit UTC offsets or Unix seconds/milliseconds and sorts actual rows', () => {
  const candles = bars(60);
  const formats = [
    JSON.stringify(candles),
    JSON.stringify({ candles: [...candles].reverse().map(candle => ({ ...candle, time: candle.time / 1000 })) }),
    JSON.stringify(candles.map(candle => ({ ...candle, time: new Date(candle.time).toISOString().replace('Z', '+00:00') }))),
    '\uFEFFtime,open,high,low,close\r\n' + candles.map(candle => `${new Date(candle.time).toISOString()},"100","101","99","100"`).join('\r\n'),
    'timestamp,open,high,low,close\n' + candles.map(candle => `${candle.time / 1000},100,101,99,100`).join('\n'),
  ];
  for (const text of formats) assert.deepEqual(normalize(review.parseReviewCandles(text, now)), candles);
});

test('rejects malformed files, duplicate timestamps, bad OHLC and ambiguous/future timestamps without inventing candles', () => {
  for (const value of ['', '{broken', JSON.stringify(bars(59)), JSON.stringify(bars(5001)), 'close,open,high,low\n100,100,101,99', 'time,open,high,low,close,time\n0,100,101,99,100,0', 'x'.repeat(review.maxReviewTextBytes + 1)])
    assert.throws(() => review.parseReviewCandles(value, now));
  for (const patch of [
    { time: '2026-11-05 11:00:00' }, { time: now + 1 }, { time: 'not a date' }, { time: 0 },
    { open: null }, { close: '' }, { high: 98 }, { low: 102 }, { low: 0 }, { close: true }, { open: 'Infinity' },
  ]) {
    const value = bars(60); value[0] = { ...value[0], ...patch };
    assert.throws(() => review.parseReviewCandles(JSON.stringify(value), now), JSON.stringify(patch));
  }
  const duplicate = bars(60); duplicate[1].time = duplicate[0].time;
  assert.throws(() => review.parseReviewCandles(JSON.stringify(duplicate), now), /Duplicate/);
  const csv = 'time,open,high,low,close\n' + bars(60).map(candle => `${candle.time},100,101,99,100`).join('\n') + ',extra';
  assert.throws(() => review.parseReviewCandles(csv, now), /number of columns/);
});

test('invalid calendar dates must not roll over into an apparently valid observation', () => {
  for (const time of ['2026-02-30T00:00:00Z', '2026-02-29T01:00:00+03:00', '2026-04-31T00:00:00Z']) {
    const value = bars(60); value[0].time = time;
    assert.throws(() => review.parseReviewCandles(JSON.stringify(value), now), /timestamp/);
  }
});

test('input validation bounds context and emits only the four allowed prompt fields', () => {
  assert.deepEqual(normalize(review.validateReviewInput({ ...input, system_instruction: 'ignore policy', oversized: 'x'.repeat(3000) })), input);
  for (const invalid of [null, [], { ...input, symbol: 'https://evil.test' }, { ...input, symbol: 'eur/usd' }, { ...input, timeframe: '1s' }, { ...input, strategy: 'MAGIC' }, { ...input, context: 'x'.repeat(2001) }])
    assert.throws(() => review.validateReviewInput(invalid));
});

test('forming/future bars cannot influence a review and the prior range excludes the latest completed close', () => {
  const value = bars();
  value[value.length - 1] = { ...value.at(-1), close: 103, high: 104 };
  const completed = review.reviewCandles(value, input, 'upload.csv', now);
  const withFuture = review.reviewCandles([...value, { time: now, open: 100, high: 99999, low: 1, close: 999 }, { time: now + minute, open: 100, high: 999999, low: 1, close: 999 }], input, 'upload.csv', now);
  assert.deepEqual(normalize(withFuture), normalize(completed));
  assert.equal(completed.lastClosedAt, now);
  assert.equal(completed.candlesUsed, 100);
  assert.equal(completed.levels[0].price, 101);
  assert.equal(completed.levels[2].price, 99);
  assert.ok(completed.observations.some(text => /broke above/.test(text)));
  assert.throws(() => review.reviewCandles(bars(60), { ...input, timeframe: '1h' }, 'upload.csv', now), /60 completed/);
});

test('ICT/SMC sweep rules distinguish wick rejection from a completed breakout', () => {
  for (const strategy of ['ICT', 'SMC']) {
    for (const [patch, expected] of [[{ high: 103 }, /upper liquidity-sweep/], [{ low: 97 }, /lower liquidity-sweep/], [{ high: 104, close: 103 }, /No range liquidity-sweep/]]) {
      const value = bars(); value[99] = { ...value[99], ...patch };
      const result = review.reviewCandles(value, { ...input, strategy }, 'input.json', now);
      assert.ok(result.observations.some(text => expected.test(text)));
    }
  }
});

test('gap references persist through partial touches and disappear after full traversal', () => {
  for (const side of ['bull', 'bear']) {
    const value = bars();
    value[97] = side === 'bull' ? { ...value[97], open: 104, high: 106, low: 103, close: 105 } : { ...value[97], open: 96, high: 97, low: 94, close: 95 };
    for (const i of [98, 99]) value[i] = side === 'bull' ? { ...value[i], open: 104, close: 104, high: 105, low: 102.5 } : { ...value[i], open: 96, close: 96, high: 97.5, low: 95 };
    const partial = review.reviewCandles(value, input, 'input.json', now);
    assert.ok(partial.levels.some(level => /three-bar gap midpoint/.test(level.label)));
    if (side === 'bull') value[99].low = 100.5; else value[99].high = 99.5;
    const filled = review.reviewCandles(value, input, 'input.json', now);
    assert.ok(!filled.levels.some(level => /three-bar gap midpoint/.test(level.label)));
  }
});

test('MSNR uses confirmed five-bar swings and leaves unconfirmed recent pivots out', () => {
  const value = bars(); value[90].high = 110; value[94].low = 90; value[98].high = 120;
  const result = review.reviewCandles(value, { ...input, strategy: 'MSNR' }, 'input.json', now);
  const swings = result.levels.filter(level => /Confirmed swing/.test(level.label));
  assert.ok(swings.some(level => level.price === 110));
  assert.ok(swings.some(level => level.price === 90));
  assert.ok(!swings.some(level => level.price === 120));
  assert.ok(!result.levels.some(level => /gap/.test(level.label)));
});

test('reviews bound history, identify stale/session gaps and label supplied fundamental notes as unverified', () => {
  const value = bars(1100); value[1098].time -= minute / 2;
  const result = review.reviewCandles(value, { ...input, context: 'CPI has increased' }, 'local.csv', now + minute * 5);
  assert.equal(result.candlesUsed, 1000);
  assert.ok(result.limitations.some(text => /older than three/.test(text)));
  assert.ok(result.limitations.some(text => /spacing differs/.test(text)));
  assert.ok(result.limitations.some(text => /unverified context/.test(text)));
  assert.ok(result.limitations.some(text => /not AI.*future price prediction/.test(text)));
  assert.equal(result.scenarios.length, 3);
});
