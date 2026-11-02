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
