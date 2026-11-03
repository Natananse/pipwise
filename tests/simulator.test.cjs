const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports = {}) { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => imports[name], Date, Math, Number, Error }); return module.exports; }
const market = load('src/lib/market.ts');
const sim = load('src/lib/simulator.ts', { './market': market });
const eur = market.assets[0];
test('opening and closing a long returns collateral and deducts both fees', () => { const opened = sim.openOrder(sim.initialWallet, eur, 'buy', 100); assert.equal(opened.positions.length, 1); assert.ok(Math.abs(sim.summary(opened).equity - (10000 - eur.price * 100 * sim.feeRate)) < 1e-8); const closed = sim.closePosition(opened, opened.positions[0].id); assert.equal(closed.positions.length, 0); assert.equal(closed.history.length, 1); assert.ok(Math.abs(closed.cash - (10000 - eur.price * 100 * sim.feeRate * 2)) < 1e-8); });
test('short and long profit calculations move in opposite directions', () => { const long = sim.openOrder(sim.initialWallet, eur, 'buy', 100).positions[0]; const short = { ...long, direction: 'sell' }; assert.ok(sim.pnl(long, eur.price + 0.1) > 0); assert.ok(sim.pnl(short, eur.price + 0.1) < 0); });
test('orders reject invalid quantity, unavailable funds and invalid protective levels', () => { for (const q of [0, -1, NaN, Infinity, 1e12]) assert.throws(() => sim.openOrder(sim.initialWallet, eur, 'buy', q)); assert.throws(() => sim.openOrder(sim.initialWallet, eur, 'buy', 10, eur.price + 1)); assert.throws(() => sim.openOrder(sim.initialWallet, eur, 'sell', 10, undefined, eur.price + 1)); assert.throws(() => sim.closePosition(sim.initialWallet, 'missing')); });
test('wallet inputs remain immutable and sequential orders respect available funds', () => { const first = sim.openOrder(sim.initialWallet, eur, 'sell', 5000); assert.equal(sim.initialWallet.cash, 10000); assert.equal(sim.initialWallet.positions.length, 0); assert.throws(() => sim.openOrder(first, eur, 'buy', 5000)); });
test('simulated candles are deterministic, chronological, and bounded by OHLC', () => { const candles = market.generateCandles(eur); assert.equal(candles.length, 110); assert.equal(JSON.stringify(candles), JSON.stringify(market.generateCandles(eur))); candles.forEach((c, i) => { assert.ok(c.high >= c.open && c.high >= c.close); assert.ok(c.low <= c.open && c.low <= c.close); if (i) assert.ok(c.time > candles[i - 1].time); }); });

const yen = market.assets.find(asset => asset.symbol === 'USD/JPY');
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);

test('USD notional preserves USD-quoted assets and values USD/JPY base units as dollars', () => {
  closeTo(market.usdNotional(eur, 100), eur.price * 100);
  closeTo(market.usdNotional(market.assets.find(asset => asset.symbol === 'BTC/USD'), 0.01), 674.328);
  closeTo(market.usdNotional(yen, 100), 100);
});

test('USD/JPY reserves dollar collateral and deducts dollar entry and exit fees', () => {
  for (const side of ['buy', 'sell']) {
    const opened = sim.openOrder(sim.initialWallet, yen, side, 100);
    closeTo(opened.cash, 9899.98);
    closeTo(opened.positions[0].fee, 0.02);
    closeTo(sim.summary(opened).reserved, 100);
    closeTo(sim.summary(opened).equity, 9999.98);
    const closed = sim.closePosition(opened, opened.positions[0].id);
    closeTo(closed.cash, 9999.96);
    closeTo(closed.history[0].pnl, -0.04);
    assert.equal(closed.positions.length, 0);
    assert.equal(opened.positions.length, 1);
    assert.equal(sim.initialWallet.cash, 10000);
    assert.equal(sim.initialWallet.positions.length, 0);
  }
});

test('USD/JPY converts both long and short yen P&L at the current quote', () => {
  const position = sim.openOrder(sim.initialWallet, yen, 'buy', 100).positions[0];
  const short = { ...position, direction: 'sell' };
  const higher = yen.price + 1;
  const lower = yen.price - 1;
  closeTo(sim.pnl(position, higher), 100 / higher);
  closeTo(sim.pnl(short, higher), -100 / higher);
  closeTo(sim.pnl(position, lower), -100 / lower);
  closeTo(sim.pnl(short, lower), 100 / lower);
});

test('USD/JPY close returns original USD collateral plus converted movement, net of fees', () => {
  const opened = sim.openOrder(sim.initialWallet, { ...yen, price: yen.price - 1 }, 'buy', 100);
  const gain = 100 / yen.price;
  closeTo(sim.summary(opened).unrealized, gain);
  closeTo(sim.summary(opened).equity, 9999.98 + gain);
  const closed = sim.closePosition(opened, opened.positions[0].id);
  closeTo(closed.cash, 10000 + gain - 0.04);
  closeTo(closed.history[0].pnl, gain - 0.04);
  closeTo(sim.summary(closed).realized, gain - 0.04);
  closeTo(opened.cash, 9899.98);
});

test('USD/JPY available-funds validation includes fees with base-dollar quantities', () => {
  const wallet = { ...sim.initialWallet, cash: 100 };
  assert.throws(() => sim.openOrder(wallet, yen, 'buy', 100));
  const quantity = wallet.cash / (market.usdNotional(yen, 1) * (1 + sim.feeRate));
  const opened = sim.openOrder(wallet, yen, 'buy', quantity);
  closeTo(opened.cash, 0);
  closeTo(sim.summary(opened).reserved, quantity);
});
