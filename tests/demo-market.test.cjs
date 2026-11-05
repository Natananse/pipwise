const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: name => imports[name], Date, Math, Number, Error, Set, JSON, Object });
  return module.exports;
}
const market = load('src/lib/market.ts');
const types = load('src/lib/marketTypes.ts');
const demo = load('src/lib/demoMarket.ts', { './market': market, './marketTypes': types });
const sim = load('src/lib/simulator.ts', { './market': market });
const started = Date.UTC(2026, 10, 5, 12, 0, 10);
const create = () => demo.createDemoMarket({ now: () => started, seed: 71 });
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);

test('seeded ticks move up and down, stay positive, and every chart closes at the executable quote', () => {
  const first = create();
  const second = create();
  let increases = 0;
  let decreases = 0;
  let previous = first.getQuote('EUR/USD').price;
  for (let i = 1; i <= 2000; i++) {
    first.tick(started + i * 1000);
    second.tick(started + i * 1000);
    const quote = first.getQuote('EUR/USD').price;
    increases += quote > previous;
    decreases += quote < previous;
    previous = quote;
  }
  assert.ok(increases > 100 && decreases > 100);
  assert.equal(JSON.stringify(first.serialize()), JSON.stringify(second.serialize()));
  for (const asset of market.assets) {
    const quote = first.getQuote(asset.symbol);
    assert.ok(quote.price > 0 && quote.price >= asset.price * .5 && quote.price <= asset.price * 1.5);
    assert.match(quote.source, /simulated/);
    for (const timeframe of types.marketTimeframes) {
      const series = first.getSeries(asset.symbol, timeframe);
      assert.equal(series.candles.at(-1).close, quote.price);
      assert.equal(series.asOf, quote.asOf);
      assert.ok(series.candles.length <= 120);
      for (const [i, candle] of series.candles.entries()) {
        assert.ok(candle.low > 0);
        assert.ok(candle.low <= Math.min(candle.open, candle.close));
        assert.ok(candle.high >= Math.max(candle.open, candle.close));
        assert.ok(candle.time <= quote.asOf);
        assert.equal(candle.time % types.timeframeMilliseconds[timeframe], 0);
        if (i) assert.ok(candle.time > series.candles[i - 1].time);
      }
    }
  }
});

test('forming candles retain their open and extremes; new bars open at the previous tick', () => {
  const feed = create();
  const initial = feed.getSeries('EUR/USD', '1m').candles.at(-1);
  feed.tick(started + 1000);
  const first = feed.getSeries('EUR/USD', '1m').candles.at(-1);
  feed.tick(started + 2000);
  const second = feed.getSeries('EUR/USD', '1m').candles.at(-1);
  assert.equal(second.time, initial.time);
  assert.equal(second.open, initial.open);
  assert.ok(second.high >= first.high && second.low <= first.low);
  const priorPrice = feed.getQuote('EUR/USD').price;
  feed.tick(started + 51000);
  const next = feed.getSeries('EUR/USD', '1m').candles.at(-1);
  assert.equal(next.time, initial.time + 60000);
  assert.equal(next.open, priorPrice);
});

test('reference levels use completed bars and cannot look ahead into the forming candle', () => {
  const feed = create();
  const original = JSON.stringify(feed.getLevels('EUR/USD', '1m'));
  for (let i = 1; i < 40; i++) feed.tick(started + i * 1000);
  assert.equal(JSON.stringify(feed.getLevels('EUR/USD', '1m')), original);
  const completed = feed.getSeries('EUR/USD', '1m').candles.slice(0, -1);
  const levels = feed.getLevels('EUR/USD', '1m');
  const prior = completed.at(-1);
  closeTo(levels.find(level => level.label.startsWith('Pivot')).price, (prior.high + prior.low + prior.close) / 3);
  closeTo(levels[0].price, Math.max(...completed.slice(-20).map(candle => candle.high)));
  closeTo(levels.at(-1).price, Math.min(...completed.slice(-20).map(candle => candle.low)));
  feed.tick(started + 60000);
  assert.notEqual(JSON.stringify(feed.getLevels('EUR/USD', '1m')), original);
});

test('long pauses add flat gaps rather than unseen price paths and keep bounded history', () => {
  const feed = create();
  const before = feed.getQuote('EUR/USD').price;
  const resumedAt = started + 12 * 86400000;
  feed.tick(resumedAt);
  const candles = feed.getSeries('EUR/USD', '1m').candles;
  assert.equal(candles.length, 120);
  for (const candle of candles.slice(0, -1)) assert.equal(candle.open, before);
  for (const candle of candles.slice(0, -1)) assert.equal(candle.close, before);
  assert.ok(Math.abs(feed.getQuote('EUR/USD').price / before - 1) < .002);
  const revision = feed.getSnapshot().revision;
  feed.tick(resumedAt - 1000);
  feed.tick(NaN);
  assert.equal(feed.getSnapshot().revision, revision);
});

test('saved quotes, candles and random sequence restore together without resetting position marks', () => {
  const first = create();
  first.tick(started + 1000);
  first.tick(started + 2000);
  const restored = demo.createDemoMarket({ now: () => started + 10000, seed: 99 });
  assert.equal(restored.restore(first.serialize()), true);
  assert.equal(restored.getQuote('EUR/USD').price, first.getQuote('EUR/USD').price);
  first.tick(started + 11000);
  restored.tick(started + 11000);
  assert.equal(JSON.stringify(first.serialize()), JSON.stringify(restored.serialize()));
  const corrupt = first.serialize();
  corrupt.quotes['EUR/USD'].price = -1;
  assert.equal(restored.restore(corrupt), false);
  const badMetadata = first.serialize();
  badMetadata.quotes['EUR/USD'].changePercent = null;
  assert.equal(restored.restore(badMetadata), false);
  assert.equal(restored.restore(null), false);
});

test('one quote drives order entry, displayed mark, exit fee and wallet P&L', () => {
  const feed = create();
  feed.tick(started + 1000);
  const entryAsset = feed.getAsset('EUR/USD');
  const opened = sim.openOrder(sim.initialWallet, entryAsset, 'buy', 100, undefined, undefined, { pricingSource: demo.demoPricingSource });
  const position = opened.positions[0];
  assert.equal(position.entry, feed.getSeries(position.symbol, '1m').candles.at(-1).close);
  feed.tick(started + 2000);
  const exit = feed.getQuote(position.symbol).price;
  const gain = (exit - position.entry) * position.quantity;
  closeTo(sim.summary(opened, { [position.symbol]: exit }).unrealized, gain);
  assert.throws(() => sim.closePosition(opened, position.id));
  const closed = sim.closePosition(opened, position.id, exit);
  closeTo(closed.history[0].exit, exit);
  closeTo(closed.history[0].pnl, gain - position.fee - exit * position.quantity * sim.feeRate);
  closeTo(closed.cash, sim.initialWallet.cash + closed.history[0].pnl);
  assert.equal(opened.positions.length, 1);
});

test('legacy positions keep their fixed valuation even when moving quotes are supplied', () => {
  const eur = market.assets[0];
  const legacy = sim.openOrder(sim.initialWallet, eur, 'buy', 100);
  assert.equal(sim.summary(legacy, { [eur.symbol]: eur.price * 2 }).unrealized, 0);
  const closed = sim.closePosition(legacy, legacy.positions[0].id, eur.price * 2);
  assert.equal(closed.history[0].exit, eur.price);
  for (const price of [NaN, Infinity, -1, 0]) assert.throws(() => sim.openOrder(sim.initialWallet, { ...eur, price }, 'buy', 1));
});

test('moving USD/JPY long and short close at the same quote with dollar collateral and fees', () => {
  const feed = create();
  const asset = feed.getAsset('USD/JPY');
  for (const direction of ['buy', 'sell']) {
    const opened = sim.openOrder(sim.initialWallet, asset, direction, 100, undefined, undefined, { pricingSource: demo.demoPricingSource });
    const position = opened.positions[0];
    const exit = asset.price + 1;
    const gain = 100 / exit * (direction === 'buy' ? 1 : -1);
    closeTo(sim.summary(opened, { [asset.symbol]: exit }).unrealized, gain);
    const closed = sim.closePosition(opened, position.id, exit);
    closeTo(closed.cash, 10000 + gain - .04);
    closeTo(closed.history[0].pnl, gain - .04);
    for (const invalid of [0, NaN, Infinity, -1]) assert.throws(() => sim.closePosition(opened, position.id, invalid));
  }
});
